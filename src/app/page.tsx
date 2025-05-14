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
import { generateImage as generateImageFlow, type GenerateImageOutput } from '@/ai/flows/generate-image-flow';
import { useToast } from "@/hooks/use-toast";
import { useSpeech } from '@/hooks/useSpeech';

// Combined type for answer data, including potential image URI
type CombinedAnswerData = (AnalyzeUploadedContentOutput | AnswerWithWebSearchOutput) & { generatedImageUri?: string };


export default function InsightFlowPage() {
  const [currentFile, setCurrentFile] = useState<{ name: string; type: string; dataUri: string } | null>(null);
  const [question, setQuestion] = useState<string>("");
  const [answerData, setAnswerData] = useState<CombinedAnswerData | null>(null);
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
          variant: "default",
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
      if (currentFile) {
        const analysisResult = await analyzeUploadedContent({
          fileDataUri: currentFile.dataUri,
          question: question,
          fileType: currentFile.type,
        });
        finalAnswerData = analysisResult;

        if (analysisResult.requiresImageGeneration && analysisResult.imageGenerationPrompt &&
            (currentFile.type === 'application/pdf' || currentFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
          try {
            toast({ title: "Generating Image", description: "Please wait while the AI creates a visual representation." });
            const imageResult: GenerateImageOutput = await generateImageFlow({
              documentDataUri: currentFile.dataUri,
              prompt: analysisResult.imageGenerationPrompt,
            });
            if (imageResult.imageDataUri) {
              finalAnswerData = { ...analysisResult, generatedImageUri: imageResult.imageDataUri };
              toast({ title: "Image Generated", description: "The AI has generated an image based on your request." });
            } else {
               toast({ title: "Image Generation Note", description: "Could not generate an image for this request. Displaying textual answer.", variant: "default" });
            }
          } catch (imgError) {
            console.error("Error generating image:", imgError);
            const imgErrorMessage = imgError instanceof Error ? imgError.message : "Unknown image generation error.";
            toast({
              title: "Image Generation Error",
              description: `Failed to generate image: ${imgErrorMessage}`,
              variant: "destructive",
            });
            // Keep the textual answer even if image generation fails
          }
        }
      } else {
        finalAnswerData = await answerWithWebSearch({ question: question });
      }
      
      setAnswerData(finalAnswerData);

      if (finalAnswerData && finalAnswerData.answer && speech.supported) {
        speech.speak(finalAnswerData.answer);
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
        speech.speak(errorAnswer.answer);
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

          <div className="lg:col-span-2 space-y-6">
            <AnswerDisplayCard
              answerData={answerData}
              isLoading={isLoading}
              speechControl={speech}
            />
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
        </div>
      </main>
      <footer className="text-center p-4 text-sm text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} InsightFlow. All rights reserved.
      </footer>
    </div>
  );
}
