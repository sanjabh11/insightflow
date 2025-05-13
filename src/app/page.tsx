"use client";

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { FileUploadCard } from '@/components/FileUploadCard';
import { QueryInputCard } from '@/components/QueryInputCard';
import { AnswerDisplayCard } from '@/components/AnswerDisplayCard';
import { VisualizationCard } from '@/components/VisualizationCard';
import { AudioControlsCard } from '@/components/AudioControlsCard';
import { analyzeUploadedContent, type AnalyzeUploadedContentOutput } from '@/ai/flows/analyze-uploaded-content';
import { answerWithWebSearch, type AnswerWithWebSearchOutput } from '@/ai/flows/answer-with-web-search';
import { useToast } from "@/hooks/use-toast";
import { useSpeech } from '@/hooks/useSpeech';

export default function InsightFlowPage() {
  const [currentFile, setCurrentFile] = useState<{ name: string; type: string; dataUri: string } | null>(null);
  const [question, setQuestion] = useState<string>("");
  const [answerData, setAnswerData] = useState<AnalyzeUploadedContentOutput | AnswerWithWebSearchOutput | null>(null);
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
      toast({
        title: "Speech Error",
        description: `${speech.error.error}${speech.error.message ? `: ${speech.error.message}` : ''}`,
        variant: "destructive",
      });
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
    try {
      let result;
      if (currentFile) {
        result = await analyzeUploadedContent({
          fileDataUri: currentFile.dataUri,
          question: question,
        });
      } else {
        result = await answerWithWebSearch({ question: question });
      }
      setAnswerData(result);
      if (result && result.answer && speech.supported) { // Speak the answer if supported
        speech.speak(result.answer);
      }
    } catch (error) {
      console.error("Error processing query:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "AI Error",
        description: `Failed to get an answer: ${errorMessage}`,
        variant: "destructive",
      });
      const errorAnswer = { answer: `Sorry, I encountered an error: ${errorMessage}`, sources: [] };
      setAnswerData(errorAnswer);
      if (speech.supported) { // Speak the error message if supported
        speech.speak(errorAnswer.answer);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-secondary/50">
      <AppHeader />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-1 space-y-6">
            <FileUploadCard onFileChange={handleFileChange} currentFile={currentFile} />
            <AudioControlsCard speechControl={speech} />
            <QueryInputCard
              question={question}
              setQuestion={setQuestion}
              onSubmit={handleQuerySubmit}
              isLoading={isLoading}
              speechControl={speech}
            />
          </div>

          <div className="lg:col-span-2 space-y-6">
            <AnswerDisplayCard
              answerData={answerData}
              isLoading={isLoading}
              speechControl={speech}
            />
            {currentFile && currentFile.type === 'text/csv' && (
              <VisualizationCard csvDataUri={currentFile.dataUri} />
            )}
          </div>
        </div>
      </main>
      <footer className="text-center p-4 text-sm text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} InsightFlow. All rights reserved.
      </footer>
    </div>
  );
}
