"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, MessageSquare, Mic, MicOff } from "lucide-react";
import type { useSpeech } from "@/hooks/useSpeech"; // Import the hook's return type

interface QueryInputCardProps {
  question: string;
  setQuestion: Dispatch<SetStateAction<string>>;
  onSubmit: () => void;
  isLoading: boolean;
  speechControl: ReturnType<typeof useSpeech>;
}

export function QueryInputCard({
  question,
  setQuestion,
  onSubmit,
  isLoading,
  speechControl,
}: QueryInputCardProps) {
  const {
    supported: speechSupported,
    isListening,
    startListening,
    stopListening,
  } = speechControl;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && question.trim()) {
      onSubmit();
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <Card className="mobile-card glass w-full max-w-xl mx-auto mb-8 p-0 overflow-visible shadow-2xl">
      <CardHeader className="px-6 pt-6 pb-2">
        <CardTitle className="mobile-header flex items-center gap-3">
          <MessageSquare className="w-7 h-7 text-indigo-600" />
          Ask a Question
        </CardTitle>
        <CardDescription className="text-neutral-500">
          Ask about the uploaded file or any general knowledge question. Use the microphone to ask by voice.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder={isListening ? "Listening..." : "Type your question here..."}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            className="resize-none rounded-xl bg-blue-50 px-4 py-3 text-base text-blue-900 border-0 focus:ring-2 focus:ring-blue-200 shadow-inner"
            disabled={isLoading || isListening}
            aria-label="Question input"
          />
          <div className="flex gap-2 w-full flex-col sm:flex-row">
            <Button type="submit" disabled={isLoading || !question.trim() || isListening} className="mobile-btn flex-1 flex items-center justify-center">
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" /> Submit Question
                </>
              )}
            </Button>
            {speechSupported && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={toggleListening}
                disabled={isLoading}
                aria-label={isListening ? "Stop listening" : "Start listening"}
                className="bg-white/80 hover:bg-blue-50 border-0 shadow-none"
              >
                {isListening ? (
                  <MicOff className="h-5 w-5 text-destructive" />
                ) : (
                  <Mic className="h-5 w-5 text-blue-500" />
                )}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>

  );
}
