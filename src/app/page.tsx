"use client";

import { useState, useEffect } from 'react';

// Modular Q&A thread: store previous conversations with title and collapsed state
// (moved up for type safety)
type Conversation = { title: string; conversation: { question: string; answer: string }[]; collapsed: boolean };

// Version 2.6.0: Modular localStorage persistence for conversations
function useLocalStorageConversations(key: string, initialValue: Conversation[]) {
  // SSR-safe: always initialize with initialValue
  const [value, setValue] = useState<Conversation[]>(initialValue);

  // Load from localStorage on client only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const item = window.localStorage.getItem(key);
      if (item) setValue(JSON.parse(item));
    }
    // eslint-disable-next-line
  }, [key]);

  // Save to localStorage on value change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, value]);

  return [value, setValue] as const;
}

import { AppHeader } from '@/components/AppHeader';
import { FileUploadCard } from '@/components/FileUploadCard';
import { QueryInputCard } from '@/components/QueryInputCard';
import { AnswerDisplayCard } from '@/components/AnswerDisplayCard';
import { VisualizationCard } from '@/components/VisualizationCard';
import { AudioControlsCard } from '@/components/AudioControlsCard';
import { DarkModeToggle } from '@/components/DarkModeToggle'; // Version 1.0 modular import

import { analyzeUploadedContent, type AnalyzeUploadedContentOutput } from '@/ai/flows/analyze-uploaded-content';
import { answerWithWebSearch, type AnswerWithWebSearchOutput } from '@/ai/flows/answer-with-web-search';
import { generateImage as generateImageFlow, type GenerateImageOutput } from '@/ai/flows/generate-image-flow';
import { useToast } from "@/hooks/use-toast";
import { useSpeech } from '@/hooks/useSpeech';

// Combined type for answer data, including potential image URI
type CombinedAnswerData = (AnalyzeUploadedContentOutput | AnswerWithWebSearchOutput) & { 
  generatedImageUri?: string;
  requiresWebSearch?: boolean; // Added for API compatibility
};

// Helper: Detect if the answer indicates the file/image is not relevant
function shouldFallbackToWebSearch(answer: string): boolean {
  return /not relevant to the question|does not contain information|cannot provide instructions|image provided does not contain|file provided does not contain|I am sorry, but the image|I am sorry, but the file|no relevant information|does not answer your question|unable to answer based on the provided/i.test(answer);
}

// Helper: Parse JSON answers and extract the 'answer' field
function extractAnswer(raw: any): { answer: string, sources: string[] } {
  if (typeof raw === 'string') {
    try {
      // Security: Only parse if it looks like a JSON object
      if (raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed.answer) {
          return { answer: parsed.answer, sources: Array.isArray(parsed.sources) ? parsed.sources : [] };
        }
      }
    } catch {
      // Not JSON, return as is
      return { answer: raw, sources: [] };
    }
    return { answer: raw, sources: [] };
  } else if (typeof raw === 'object' && raw !== null && raw.answer) {
    return { answer: raw.answer, sources: Array.isArray(raw.sources) ? raw.sources : [] };
  }
  return { answer: String(raw), sources: [] };
}

export default function InsightFlowPage() {
  const [currentFile, setCurrentFile] = useState<{ name: string; type: string; dataUri: string } | null>(null);
  const [question, setQuestion] = useState<string>("");
  const [answerData, setAnswerData] = useState<CombinedAnswerData | null>(null);
  // Modular Q&A thread: persistent history
  const [qaHistory, setQaHistory] = useState<{ question: string; answer: string }[]>([]);
  // Modular: store previous conversations with title and collapsed state
  type Conversation = { title: string; conversation: { question: string; answer: string }[]; collapsed: boolean };
  const [conversations, setConversations] = useLocalStorageConversations('insightflow_conversations', []);
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();

  const speech = useSpeech();

  useEffect(() => {
    if (speech.transcript) {
      setQuestion(speech.transcript);
    }
  }, [speech.transcript]);

  useEffect(() => {
    if (speech.error) {
      if (speech.error.error === 'Speech synthesis error' && speech.error.message === 'interrupted') {
        toast({
          title: "Speech Interrupted",
          description: "Speech was interrupted. You may continue or try again.",
          variant: "default", // Use normal color, not destructive
        });
      } else {
        toast({
          title: "Speech Error",
          description: `${speech.error.error}${speech.error.message ? `: ${speech.error.message}` : ''}`,
          variant: "destructive",
        });
      }
    }
  }, [speech.error, toast]);


  const handleFileChange = (file: { name: string; type: string; dataUri: string } | null) => {
    setCurrentFile(file);
    setAnswerData(null);
    if (!file) {
      toast({ title: "File removed", description: "The uploaded file has been cleared." });
    }
  };

  /**
   * Version 1.9: Modular API-based query handler
   * This implementation uses the dedicated API route instead of direct function calls
   * to properly separate client and server logic.
   */
  const handleQuerySubmit = async () => {
    if (!question.trim()) {
      toast({ title: "Empty question", description: "Please enter a question.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setAnswerData(null);
    let finalAnswerData: CombinedAnswerData | null = null;

    const detectLanguage = (text: string) => {
      // Simple check: Hindi Unicode range
      return /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-US';
    };
    const questionLanguage = detectLanguage(question);

    try {
      // Build context from all previous Q&A in current thread
      const contextQA = qaHistory.map((qa, idx) => `Q${idx+1}: ${qa.question}\nA${idx+1}: ${qa.answer}`).join('\n');
      const fullContext = `Conversation history:\n${contextQA}${qaHistory.length ? '\n' : ''}Q${qaHistory.length+1}: ${question}`;
      
      // Prepare request payload for the API
      const requestData = {
        question: fullContext || question,
        fileDataUri: currentFile?.dataUri,
        fileType: currentFile?.type,
        requiresWebSearch: !currentFile // Auto web search if no file
      };

      // Call our new API endpoint
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const apiResponse = await response.json();
      
      // Set intermediate loading message if web search is needed
      if (apiResponse.requiresWebSearch) {
        setAnswerData({ 
          answer: "I could not find your query in this file so I will be searching internet now. Please stand by.", 
          sources: [],
          requiresWebSearch: true,
          requiresImageGeneration: false 
        });
      }
      
      finalAnswerData = apiResponse;
      setAnswerData(finalAnswerData);

      // Append to Q&A history
      if (finalAnswerData && question) {
        const extractedQA = extractAnswer(finalAnswerData);
        setQaHistory(prev => [...prev, { question, answer: extractedQA.answer ?? "" }]);
      }

      // Handle speech synthesis if available
      if (finalAnswerData && finalAnswerData.answer && speech.supported) {
        const answerLang = (questionLanguage || 'en-US');
        speech.speak(finalAnswerData.answer, answerLang);
      }

    } catch (error) {
      console.error("Error processing query:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "AI Error",
        description: `Failed to get an answer: ${errorMessage}`,
        variant: "destructive",
      });
      const errorAnswer = { 
        answer: `Sorry, I encountered an error: ${errorMessage}`, 
        sources: [], 
        requiresWebSearch: false,
        requiresImageGeneration: false 
      };
      setAnswerData(errorAnswer);
      if (speech.supported) {
        speech.speak(errorAnswer.answer, questionLanguage || 'en-US');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // EDA trigger state
  const [isEDAloading, setEDAloading] = useState<boolean>(false);
  const [edaResult, setEdaResult] = useState<CombinedAnswerData | null>(null);
  const showEDAButton = currentFile && currentFile.type === 'text/csv';

  /**
   * Version 1.9: Modular API-based EDA handler
   * Uses the same API endpoint with a special EDA question
   */
  const handleEDA = async () => {
    if (!currentFile) return;
    setEDAloading(true);
    setEdaResult(null);
    try {
      // Call our API endpoint with EDA request
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: 'Run EDA on this file and provide a comprehensive analysis',
          fileDataUri: currentFile.dataUri,
          fileType: currentFile.type,
          requiresWebSearch: false
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const analysisResult = await response.json();
      setEdaResult(analysisResult);
      toast({ title: "EDA Complete", description: "Exploratory Data Analysis has completed for your CSV file." });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during EDA.";
      toast({ title: "EDA Error", description: errorMessage, variant: "destructive" });
    } finally {
      setEDAloading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-900/50 dark:via-gray-900 dark:to-indigo-900/50 font-sans">
      <header className="w-full py-6 px-4 flex flex-col gap-1 items-start bg-white/80 dark:bg-gray-900 shadow-sm mb-6">
  <div className="w-full flex flex-row items-center justify-between">
    <span className="text-2xl font-extrabold text-blue-800 dark:text-blue-100 tracking-tight">InsightFlow</span>
    <DarkModeToggle />
  </div>
  <div className="mt-1 text-sm text-blue-900/70 dark:text-gray-400 font-medium">AI-powered file analysis and Q&A</div>
</header>
      <main className="w-full max-w-7xl mx-auto flex flex-row gap-8 px-4 md:px-0">
        {/* Left Panel */}
        <div className="flex flex-col gap-6 max-w-xs w-full md:w-1/4 overflow-y-auto">
          <FileUploadCard onFileChange={handleFileChange} currentFile={currentFile} />
          <QueryInputCard
            question={question}
            setQuestion={setQuestion}
            onSubmit={handleQuerySubmit}
            isLoading={isLoading}
            speechControl={speech}
          />
          <AudioControlsCard speechControl={speech} />
        </div>
        {/* Middle Panel: Q&A, Answer, EDA, Follow-up */}
        <div className="flex-1 flex flex-col gap-6 w-full md:w-2/4">
          {/* Q&A thread: show all Q&A pairs */}
          <div className="space-y-4">
            {qaHistory.map((qa, idx) => (
              <div key={idx} className="border dark:border-gray-700 rounded p-4 bg-white/70 dark:bg-gray-800/70">
                <div className="font-semibold text-primary dark:text-primary-dark mb-1">Q{idx + 1}: {qa.question}</div>
                <div className="text-gray-900 dark:text-gray-200">{qa.answer}</div>
              </div>
            ))}
          </div>
          {/* Show latest answer in card (for speech, etc) */}
          {answerData && (
            <AnswerDisplayCard
              answerData={answerData}
              isLoading={isLoading}
              speechControl={speech}
            />
          )}
          {/* EDA Button for CSVs only - always visible in middle panel when applicable */}
          {showEDAButton && !edaResult && (
            <button
              className={`w-full mt-2 py-2 px-4 rounded bg-primary dark:bg-primary-dark text-white font-semibold ${isEDAloading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary/80 dark:hover:bg-primary-dark/80'}`}
              onClick={handleEDA}
              disabled={isEDAloading || isLoading}
              aria-label="Run EDA"
            >
              {isEDAloading ? 'Running EDA...' : 'Run EDA (CSV Only)'}
            </button>
          )}
          {/* Modular EDA: Only show VisualizationCard after EDA is run and result is available */}
          {showEDAButton && edaResult && (
            <VisualizationCard csvDataUri={currentFile.dataUri} />
          )}
          {/* Follow-up Questions Button: Only show after first answer for uploaded file */}
          {currentFile && answerData && (
            <button
              className="w-full mt-2 py-2 px-4 rounded bg-secondary dark:bg-secondary-dark text-primary dark:text-primary-dark font-semibold border border-primary dark:border-primary-dark hover:bg-primary/10 dark:hover:bg-primary-dark/10"
              onClick={() => {
                setQuestion("");
                setAnswerData(null);
              }}
              aria-label="Ask Follow-up Question"
            >
              Ask Follow-up Question
            </button>
          )}
        </div>
        {/* Right Panel: Conversation history and actions */}
        <div className="flex flex-col gap-6 max-w-xs w-full md:w-1/4 overflow-y-auto">
          {/* Conversation History */}
          {conversations.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-md text-primary dark:text-primary-dark">Previous Conversations</div>
                <button
                  className="py-1 px-3 rounded bg-green-600 dark:bg-green-700 text-white text-xs font-semibold border border-green-800 dark:border-green-900 hover:bg-green-700 dark:hover:bg-green-600"
                  onClick={() => {
                    // Export all conversations and current thread (if any)
                    const exportData = [
                      ...conversations.map(({ title, conversation }) => ({ title, conversation })),
                      ...(qaHistory.length > 0 ? [{ title: 'Current Conversation', conversation: qaHistory }] : [])
                    ];
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `conversations_${new Date().toISOString()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  aria-label="Export History"
                >
                  Export History
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {conversations.map((conv, cIdx) => (
                  <div
                    key={cIdx}
                    className="border dark:border-gray-700 rounded p-2 bg-gray-50 dark:bg-gray-800 transition relative"
                    aria-label="Run EDA" // This aria-label seems incorrect for a conversation item
                  >
                    {/* Collapse/expand and rename controls */}
                    <div className="flex items-center justify-between mb-1">
                      {renamingIdx === cIdx ? (
                        <input
                          className="border dark:border-gray-600 px-2 py-1 rounded text-primary dark:text-gray-100 bg-white dark:bg-gray-700 font-semibold w-2/3"
                          value={renameValue}
                          autoFocus
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => {
                            setConversations(prev => prev.map((c, idx) => idx === cIdx ? { ...c, title: renameValue || c.title } : c));
                            setRenamingIdx(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              setConversations(prev => prev.map((c, idx) => idx === cIdx ? { ...c, title: renameValue || c.title } : c));
                              setRenamingIdx(null);
                            }
                          }}
                        />
                      ) : (
                        <span className="font-semibold text-primary dark:text-primary-dark cursor-pointer" title="Click to rename" onClick={() => { setRenamingIdx(cIdx); setRenameValue(conv.title); }}>{conv.title}</span>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs text-blue-700 dark:text-blue-400 hover:underline"
                          onClick={() => setConversations(prev => prev.map((c, idx) => idx === cIdx ? { ...c, collapsed: !c.collapsed } : c))}
                          aria-label={conv.collapsed ? 'Expand thread' : 'Collapse thread'}
                        >
                          {conv.collapsed ? 'Expand' : 'Collapse'}
                        </button>
                        <button
                          className="text-xs text-green-700 dark:text-green-400 hover:underline"
                          title="Click to revisit and continue this conversation"
                          onClick={() => {
                            setQaHistory(conv.conversation);
                            setConversations(prev => prev.filter((_, i) => i !== cIdx));
                            setQuestion("");
                            setAnswerData(null);
                          }}
                          aria-label={`Revisit conversation ${cIdx + 1}`}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                    {!conv.collapsed && (
                      <div>
                        {conv.conversation.map((qa, idx) => (
                          <div key={idx} className="mb-1">
                            <span className="font-semibold text-primary dark:text-primary-dark">Q{idx + 1}:</span> <span className="text-gray-800 dark:text-gray-300">{qa.question}</span>
                            <div className="ml-4 text-gray-900 dark:text-gray-200">{qa.answer}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* New Question Button: Always visible if there is any Q&A history */}
          {qaHistory.length > 0 && (
            <button
              className="w-full mt-2 py-2 px-4 rounded bg-blue-500 dark:bg-blue-600 text-white font-semibold border border-blue-700 dark:border-blue-800 hover:bg-blue-600 dark:hover:bg-blue-500"
              onClick={() => {
                setConversations(prev => qaHistory.length > 0 ? [...prev, { title: `Conversation ${prev.length + 1}`, conversation: qaHistory, collapsed: true }] : prev);
                setQaHistory([]);
                setQuestion("");
                setAnswerData(null);
                setCurrentFile(null); // Auto-clear the loaded file when starting a new conversation
              }}
              aria-label="Start New Question"
            >
              New Question
            </button>
          )}
          {/* Erase History Button: Always visible if there is any Q&A/conversation history */}
          {(qaHistory.length > 0 || conversations.length > 0) && (
            <button
              className="w-full mt-2 py-2 px-4 rounded bg-red-500 dark:bg-red-600 text-white font-semibold border border-red-700 dark:border-red-800 hover:bg-red-600 dark:hover:bg-red-500"
              onClick={() => {
                setQaHistory([]);
                setConversations([]);
                setQuestion("");
                setAnswerData(null);
              }}
              aria-label="Erase History"
            >
              Erase History
            </button>
          )}
        </div>
      </main>
      <footer className="text-center p-4 text-sm text-muted-foreground border-t border-border">
        &copy; {new Date().getFullYear()} InsightFlow. All rights reserved.
      </footer>
    </div>
  );
}
