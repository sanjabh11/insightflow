"use client";

import type { Dispatch, SetStateAction } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, MessageSquare } from "lucide-react";

interface QueryInputCardProps {
  question: string;
  setQuestion: Dispatch<SetStateAction<string>>;
  onSubmit: () => void;
  isLoading: boolean;
}

export function QueryInputCard({ question, setQuestion, onSubmit, isLoading }: QueryInputCardProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && question.trim()) {
      onSubmit();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-primary" />
          Ask a Question
        </CardTitle>
        <CardDescription>
          Ask about the uploaded file or any general knowledge question if no file is uploaded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Type your question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            className="resize-none"
            disabled={isLoading}
            aria-label="Question input"
          />
          <Button type="submit" disabled={isLoading || !question.trim()} className="w-full">
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
        </form>
      </CardContent>
    </Card>
  );
}
