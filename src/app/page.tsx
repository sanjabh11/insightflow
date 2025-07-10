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
import { AudioControlsCard } from '@/components/AudioControlsCard';
import { VisualizationCard } from '@/components/VisualizationCard';
import { motion, AnimatePresence } from 'framer-motion';
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
  return /not relevant to the question|does not contain information|cannot provide instructions|image provided does not contain|file provided does not contain|I am sorry, but the image|I am sorry, but the file|no relevant information|does not answer your question|unable to answer based on the provided|no answer found|no answer/i.test(answer);
}

// Modular: Web search fallback using Firecrawl
async function fetchWebSearchAnswer(query: string): Promise<{ answer: string; sources: {title: string, url: string}[] }> {
  // Firecrawl or similar API integration
  try {
    const response = await fetch('/api/websearch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    if (!response.ok) throw new Error('Web search failed');
    const data = await response.json();
    return { answer: data.answer, sources: data.sources || [] };
  } catch (err) {
    return { answer: 'No relevant answer found on the internet.', sources: [] };
  }
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
  const [currentFile, setCurrentFile] = useState<{ name: string; type: string; dataUri: string; preview?: string } | null>(null);
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

  // Version 2.9.1: Proactive web search fallback
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
      // Modular context system prompt (restores after merge)
      const systemPrompt = `SYSTEM: You are an AI assistant. If the latest user question is a follow-up or uses pronouns or ambiguous references (like 'he', 'she', 'they', 'the person'), always resolve them using the latest relevant entity in the conversation history. Never ask the user to repeat the name. If the user requests a web search, use the most relevant previous question as the web search query. Use the full conversation history below to resolve context.`;
      const fullContext = `${systemPrompt}\nConversation history:\n${contextQA}${qaHistory.length ? '\n' : ''}Q${qaHistory.length+1}: ${question}`;
      if (currentFile) {
        // Pass full context to backend/LLM
        const getFileContentForAnalysis = (file: typeof currentFile) => {
          if (!file) return '';
          if (
            file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.type === 'application/zip' ||
            file.type === 'text/plain'
          ) {
            return file.preview || '';
          }
          return file.dataUri;
        };
        const analysisResult = await analyzeUploadedContent({
          fileDataUri: getFileContentForAnalysis(currentFile),
          question: fullContext,
          fileType: currentFile.type
        });
        finalAnswerData = analysisResult;

        // Always extract the answer for further checks
        const extracted = extractAnswer(analysisResult);

        // If backend signals web search is needed, trigger it automatically
        if ('requiresWebSearch' in analysisResult && analysisResult.requiresWebSearch) {
          setAnswerData({ answer: "I could not find your query in this file so I will be searching internet now. Please stand by.", sources: [] });
          const lastRelevant = [...qaHistory].reverse().find(qa => !/follow[- ]?up|search|internet|context|find out|look at/i.test(qa.question));
          const webSearchQuery = lastRelevant ? lastRelevant.question : question;
          finalAnswerData = await answerWithWebSearch({ question: webSearchQuery });
        } else if (
          extracted.answer &&
          (shouldFallbackToWebSearch(extracted.answer) || (Array.isArray(extracted.sources) && extracted.sources.some(s => /search|web search/i.test(s))))
        ) {
          setAnswerData({ answer: "I could not find your query in this file so I will be searching internet now. Please stand by.", sources: [] });
          finalAnswerData = await answerWithWebSearch({ question });
        } else {
          // Use the extracted answer for display
          setAnswerData(extracted);
        }

        // Type guard for requiresImageGeneration and imageGenerationPrompt
        if (
          finalAnswerData &&
          typeof finalAnswerData === 'object' &&
          'requiresImageGeneration' in finalAnswerData &&
          (finalAnswerData as any).requiresImageGeneration &&
          'imageGenerationPrompt' in finalAnswerData &&
          (finalAnswerData as any).imageGenerationPrompt &&
          (currentFile.type === 'application/pdf' || currentFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        ) {
          try {
            toast({ title: "Generating Image", description: "Please wait while the AI creates a visual representation." });
            const imageResult: GenerateImageOutput = await generateImageFlow({
              documentDataUri: currentFile.dataUri,
              prompt: (finalAnswerData as any).imageGenerationPrompt,
            });
            if (imageResult.imageDataUri) {
              (finalAnswerData as any).generatedImageUri = imageResult.imageDataUri;
            }
          } catch (imageError) {
            toast({ title: "Image Generation Error", description: "Failed to generate image." });
          }
        }
      } else {
        // No file: always use context for web search
        // Determine if the current question is an explicit follow-up
        const isExplicitFollowup = /^(follow[- ]?up|same|continue)$/i.test(question.trim());
        const lastRelevant = [...qaHistory].reverse().find(qa => !/follow[- ]?up|search|internet|context|find out|look at/i.test(qa.question));
        const webSearchQuery = isExplicitFollowup && lastRelevant ? lastRelevant.question : question;
        finalAnswerData = await answerWithWebSearch({ question: webSearchQuery });
      }
      
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
      const getFileContentForAnalysis = (file: typeof currentFile) => {
        if (!file) return '';
        if (
          file.type === 'text/csv' && file.preview
        ) {
          return file.preview;
        }
        return file.dataUri;
      };
      const analysisResult = await analyzeUploadedContent({
        fileDataUri: getFileContentForAnalysis(currentFile),
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
      <main className="w-full max-w-7xl mx-auto flex flex-col md:flex-row gap-6 md:gap-8 px-2 sm:px-4">
        {/* Left Panel */}
        <motion.section
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-6 w-full md:w-1/4 max-w-xs md:max-w-xs mb-4 md:mb-0"
        >
        {/* Left Panel */}
          <FileUploadCard onFileChange={handleFileChange} currentFile={currentFile} />
          <QueryInputCard
            question={question}
            setQuestion={setQuestion}
            onSubmit={handleQuerySubmit}
            isLoading={isLoading}
            speechControl={speech}
          />
          <AudioControlsCard speechControl={speech} />
        </motion.section>
        {/* Middle Panel: Q&A, Answer, EDA, Follow-up */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.5 }}
          className="flex-1 flex flex-col gap-6 w-full md:w-2/4"
        >
          {/* Chat dialog bubbles */}
          <div className="flex flex-col gap-2 h-full overflow-y-auto px-2 py-2 bg-gray-50 rounded-lg border min-h-[300px] max-h-[400px]">
            {qaHistory.length === 0 && (
              <div className="text-gray-400 text-center my-8">Start the conversation by asking a question!</div>
            )}
            {qaHistory.map((qa: { question: string; answer: string }, idx: number) => (
              <div key={idx} className="flex flex-col mb-2">
                <div className="inline-block px-4 py-2 rounded-2xl shadow bg-blue-100 text-blue-900 self-end" style={{ maxWidth: '80%' }}>
                  <span className="block font-semibold">You:</span> {qa.question}
                </div>
                {qa.answer && (
                  <div className="inline-block px-4 py-2 rounded-2xl shadow bg-green-100 text-green-900 self-start mt-1" style={{ maxWidth: '80%' }}>
                    <span className="block font-semibold">AI:</span> {qa.answer}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Answer display (if present) */}
          {answerData && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.4 }}
            >
              <AnswerDisplayCard
                answerData={answerData}
                isLoading={isLoading}
                speechControl={speech}
              />
            </motion.div>
          )}

          {/* EDA controls */}
          {showEDAButton && !edaResult && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`w-full mt-2 py-2 px-4 rounded-xl bg-primary text-white font-semibold shadow-md ${isEDAloading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary/80'}`}
              onClick={handleEDA}
              disabled={isEDAloading || isLoading}
              aria-label="Run EDA"
            >
              {isEDAloading ? 'Running EDA...' : 'Run EDA (CSV Only)'}
            </motion.button>
          )}
          {showEDAButton && edaResult && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4 }}
              >
                <AnswerDisplayCard
                  answerData={edaResult}
                  isLoading={isEDAloading}
                  speechControl={speech}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4 }}
              >
                <VisualizationCard csvDataUri={currentFile.dataUri} />
              </motion.div>
            </>
          )}

        </motion.section>
        {/* Right Panel: Previous Conversations */}
        <motion.section
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 30 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 w-full md:w-1/4 max-w-xs"
        >
          <div className="border rounded p-4 bg-white/70">
            <h3 className="font-semibold mb-2">Previous Conversations</h3>
            <div className="space-y-2">
              {conversations.length === 0 && (
                <div className="text-gray-400 text-center">No previous conversations yet.</div>
              )}
              {conversations.map((conv, cIdx) => (
                <div key={cIdx} className="border rounded p-2 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                  <div className="flex justify-between items-center">
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
                      <h4 className="font-medium cursor-pointer" title="Click to rename" onClick={() => { setRenamingIdx(cIdx); setRenameValue(conv.title); }}>{conv.title}</h4>
                    )}
                    <div className="space-x-2">
                      <button
                        className="text-sm text-blue-600 hover:underline"
                        onClick={() => {
                          setConversations(prev => prev.map((c, idx) => idx === cIdx ? { ...c, collapsed: !c.collapsed } : c));
                        }}
                        aria-label={conv.collapsed ? 'Expand thread' : 'Collapse thread'}
                      >
                        {conv.collapsed ? 'Expand' : 'Collapse'}
                      </button>
                      <button
                        className="text-sm text-blue-600 hover:underline"
                        onClick={() => {
                          setQaHistory(conv.conversation);
                          setConversations(prev => prev.filter((_, idx) => idx !== cIdx));
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
            {/* Move New Question and Erase History buttons here */}
            <div className="flex flex-col gap-2 mt-4">
              <button
                className="w-full py-2 px-4 rounded bg-blue-500 text-white font-semibold border border-blue-700 hover:bg-blue-600"
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
              <button
                className="w-full py-2 px-4 rounded bg-red-500 text-white font-semibold border border-red-700 hover:bg-red-600"
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
            </div>
          </div>
        </motion.section>
      </main>
      <footer className="text-center p-4 text-sm text-muted-foreground border-t border-border">
        &copy; {new Date().getFullYear()} InsightFlow. All rights reserved.
      </footer>
    </div>
  );
}
