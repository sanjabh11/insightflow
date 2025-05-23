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
type CombinedAnswerData = (AnalyzeUploadedContentOutput | AnswerWithWebSearchOutput) & { generatedImageUri?: string };


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

  const handleQuerySubmit = async () => {
    if (!question.trim()) {
      toast({ title: "Empty question", description: "Please enter a question.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setAnswerData(null);
    let finalAnswerData: CombinedAnswerData | null = null;

    try {
      // Detect question language (simple heuristic, can be improved)
      const detectLanguage = (text: string) => {
        // Simple check: Hindi Unicode range
        return /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-US';
      };
      const questionLanguage = detectLanguage(question);
      // Build context from all previous Q&A in current thread, with explicit system prompt for context resolution
      const systemPrompt = `SYSTEM: You are an AI assistant. If the latest user question is a follow-up or uses pronouns or ambiguous references (like 'he', 'she', 'they', 'the person'), always resolve them using the latest relevant entity in the conversation history. Never ask the user to repeat the name. If the user requests a web search, use the most relevant previous question as the web search query. Use the full conversation history below to resolve context.`;
      const contextQA = qaHistory.map((qa, idx) => `Q${idx+1}: ${qa.question}\nA${idx+1}: ${qa.answer}`).join('\n');
      const fullContext = `${systemPrompt}\nConversation history:\n${contextQA}${qaHistory.length ? '\n' : ''}Q${qaHistory.length+1}: ${question}`;
      if (currentFile) {
        // Pass full context to backend/LLM
        const analysisResult = await analyzeUploadedContent({
          fileDataUri: currentFile.dataUri,
          question: fullContext,
          fileType: currentFile.type,
          language: questionLanguage // Pass to backend/LLM
        });
        finalAnswerData = analysisResult;

        // If backend signals web search is needed, trigger it automatically
        if (analysisResult.requiresWebSearch) {
          // Try to extract the last non-follow-up question for web search
          const lastRelevant = [...qaHistory].reverse().find(qa => !/follow[- ]?up|search|internet|context|find out|look at/i.test(qa.question));
          const webSearchQuery = lastRelevant ? lastRelevant.question : question;
          // Use the extracted question for web search
          finalAnswerData = await answerWithWebSearch({ question: webSearchQuery });
        }

        if (finalAnswerData && finalAnswerData.requiresImageGeneration && finalAnswerData.imageGenerationPrompt &&
            (currentFile.type === 'application/pdf' || currentFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
          try {
            toast({ title: "Generating Image", description: "Please wait while the AI creates a visual representation." });
            const imageResult: GenerateImageOutput = await generateImageFlow({
              documentDataUri: currentFile.dataUri,
              prompt: finalAnswerData.imageGenerationPrompt,
            });
            if (imageResult.imageDataUri) {
              finalAnswerData.generatedImageUri = imageResult.imageDataUri;
            }
          } catch (imageError) {
            toast({ title: "Image Generation Error", description: "Failed to generate image." });
          }
        }
      } else {
        // No file: always use context for web search
        // Try to extract the last non-follow-up question for web search
        const lastRelevant = [...qaHistory].reverse().find(qa => !/follow[- ]?up|search|internet|context|find out|look at/i.test(qa.question));
        const webSearchQuery = lastRelevant ? lastRelevant.question : question;
        finalAnswerData = await answerWithWebSearch({ question: webSearchQuery });
      }
      
      setAnswerData(finalAnswerData);

      // Append to Q&A history
      if (finalAnswerData && question) {
        setQaHistory(prev => [...prev, { question, answer: finalAnswerData.answer ?? "" }]);
      }

      if (finalAnswerData && finalAnswerData.answer && speech.supported) {
        // Use answer language if available, else fallback to question language
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
      const errorAnswer = { answer: `Sorry, I encountered an error: ${errorMessage}`, sources: [], requiresImageGeneration: false };
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

  // EDA handler for CSV only
  const handleEDA = async () => {
    if (!currentFile) return;
    setEDAloading(true);
    setEdaResult(null);
    try {
      const analysisResult = await analyzeUploadedContent({
        fileDataUri: currentFile.dataUri,
        question: 'Run EDA',
        fileType: currentFile.type,
      });
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
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-indigo-50 font-sans">
      <header className="w-full py-6 px-4 flex flex-col gap-1 items-start bg-white/80 dark:bg-gray-900 shadow-sm mb-6">
  <div className="w-full flex flex-row items-center justify-between">
    <span className="text-2xl font-extrabold text-blue-800 dark:text-blue-100 tracking-tight">InsightFlow</span>
    <DarkModeToggle />
  </div>
  <div className="mt-1 text-sm text-blue-900/70 dark:text-gray-400 font-medium">AI-powered file analysis and Q&A</div>
</header>
      <main className="w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-8 px-4 md:px-0">
        <div className="flex-1 flex flex-col gap-6 max-w-md mx-auto md:mx-0 overflow-y-auto"> {/* Make the left column scrollable */}
          <FileUploadCard onFileChange={handleFileChange} currentFile={currentFile} />
          <QueryInputCard
            question={question}
            setQuestion={setQuestion}
            onSubmit={handleQuerySubmit}
            isLoading={isLoading}
            speechControl={speech}
          />
          <AudioControlsCard speechControl={speech} />
          {/* EDA Button for CSVs only */}
          {showEDAButton && (
            <button
              className={`w-full mt-2 py-2 px-4 rounded bg-primary text-white font-semibold ${isEDAloading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary/80'}`}
              onClick={handleEDA}
              disabled={isEDAloading || isLoading}
              aria-label="Run EDA"
            >
              {isEDAloading ? 'Running EDA...' : 'Run EDA (CSV Only)'}
            </button>
          )}
        </div>
        <div className="flex-[2] flex flex-col gap-6">
          {/* Modular Q&A thread: show all previous conversations */}
          {conversations.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-md text-primary">Previous Conversations</div>
                <button
                  className="py-1 px-3 rounded bg-green-600 text-white text-xs font-semibold border border-green-800 hover:bg-green-700"
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
                    className="border rounded p-2 bg-gray-50 transition relative"
                aria-label="Run EDA"
              >
                  >
                    {/* Collapse/expand and rename controls */}
                    <div className="flex items-center justify-between mb-1">
                      {renamingIdx === cIdx ? (
                        <input
                          className="border px-2 py-1 rounded text-primary font-semibold w-2/3"
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
                        <span className="font-semibold text-primary cursor-pointer" title="Click to rename" onClick={() => { setRenamingIdx(cIdx); setRenameValue(conv.title); }}>{conv.title}</span>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs text-blue-700 hover:underline"
                          onClick={() => setConversations(prev => prev.map((c, idx) => idx === cIdx ? { ...c, collapsed: !c.collapsed } : c))}
                          aria-label={conv.collapsed ? 'Expand thread' : 'Collapse thread'}
                        >
                          {conv.collapsed ? 'Expand' : 'Collapse'}
                        </button>
                        <button
                          className="text-xs text-green-700 hover:underline"
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
                            <span className="font-semibold text-primary">Q{idx + 1}:</span> {qa.question}
                            <div className="ml-4 text-gray-900">{qa.answer}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Modular Q&A thread: show all Q&A pairs */}
          <div className="space-y-4">
            {qaHistory.map((qa, idx) => (
              <div key={idx} className="border rounded p-4 bg-white/70">
                <div className="font-semibold text-primary mb-1">Q{idx + 1}: {qa.question}</div>
                <div className="text-gray-900">{qa.answer}</div>
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
          {/* Follow-up Questions Button: Only show after first answer for uploaded file */}
          {currentFile && answerData && (
            <button
              className="w-full mt-2 py-2 px-4 rounded bg-secondary text-primary font-semibold border border-primary hover:bg-primary/10"
              onClick={() => {
                setQuestion("");
                setAnswerData(null);
              }}
              aria-label="Ask Follow-up Question"
            >
              Ask Follow-up Question
            </button>
          )}
          {/* New Question Button: Always visible if there is any Q&A history */}
          {qaHistory.length > 0 && (
            <button
              className="w-full mt-2 py-2 px-4 rounded bg-blue-500 text-white font-semibold border border-blue-700 hover:bg-blue-600"
              onClick={() => {
                setConversations(prev => qaHistory.length > 0 ? [...prev, { title: `Conversation ${prev.length + 1}`, conversation: qaHistory, collapsed: true }] : prev);
                setQaHistory([]);
                setQuestion("");
                setAnswerData(null);
              }}
              aria-label="Start New Question"
            >
              New Question
            </button>
          )}
          {/* Erase History Button: Always visible if there is any Q&A/conversation history */}
          {(qaHistory.length > 0 || conversations.length > 0) && (
            <button
              className="w-full mt-2 py-2 px-4 rounded bg-red-500 text-white font-semibold border border-red-700 hover:bg-red-600"
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
          {showEDAButton && edaResult && (
            <AnswerDisplayCard
              answerData={edaResult}
              isLoading={isEDAloading}
              speechControl={speech}
            />
          )}
          {/* Modular EDA: Only show VisualizationCard after EDA is run and result is available */}
          {showEDAButton && edaResult && (
            <VisualizationCard csvDataUri={currentFile.dataUri} />
          )}
        </div>
      </main>
      <footer className="text-center p-4 text-sm text-muted-foreground border-t border-border">
        &copy; {new Date().getFullYear()} InsightFlow. All rights reserved.
      </footer>
    </div>
  );
}
