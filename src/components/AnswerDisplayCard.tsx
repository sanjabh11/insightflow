"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ThumbsUp, AlertCircle, BookOpen, BrainCircuit } from "lucide-react";
import type { AnalyzeUploadedContentOutput } from '@/ai/flows/analyze-uploaded-content';
import type { AnswerWithWebSearchOutput } from '@/ai/flows/answer-with-web-search';

interface AnswerDisplayCardProps {
  answerData: AnalyzeUploadedContentOutput | AnswerWithWebSearchOutput | null;
  isLoading: boolean;
}

export function AnswerDisplayCard({ answerData, isLoading }: AnswerDisplayCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-primary animate-pulse" />
             Generating Answer...
          </CardTitle>
          <CardDescription>Please wait while the AI processes your query.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </CardContent>
      </Card>
    );
  }

  if (!answerData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-muted-foreground" />
            AI Response
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Your answer will appear here once you submit a question.</p>
        </CardContent>
      </Card>
    );
  }
  
  const isError = answerData.answer.toLowerCase().includes("error") || answerData.answer.toLowerCase().includes("sorry");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isError ? <AlertCircle className="w-6 h-6 text-destructive" /> : <BrainCircuit className="w-6 h-6 text-primary" />}
          AI Response
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{answerData.answer}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="prose dark:prose-invert max-w-none p-4 bg-secondary/30 rounded-md">
              <p>{answerData.answer}</p>
            </div>
            {answerData.sources && answerData.sources.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  Sources:
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {answerData.sources.map((source, index) => (
                    <li key={index} className="truncate">{source}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
