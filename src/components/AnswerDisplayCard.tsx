"use client";

import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  BrainCircuit,
  AlertCircle,
  Volume2,
  VolumeX,
  Image as ImageIcon,
} from "lucide-react";
import type { AnalyzeUploadedContentOutput } from "@/ai/flows/analyze-uploaded-content-schemas";
import type { AnswerWithWebSearchOutput } from "@/ai/flows/answer-with-web-search-schemas";
import type { useSpeech } from "@/hooks/useSpeech";
import { useEffect, useRef, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


// Combined type for answer data, including potential image URI
type CombinedAnswerData = (
  | AnalyzeUploadedContentOutput
  | AnswerWithWebSearchOutput
) & { generatedImageUri?: string };

interface AnswerDisplayCardProps {
  answerData: CombinedAnswerData | null;
  isLoading: boolean;
  speechControl: ReturnType<typeof useSpeech>;
}



const VOICES = [
  { key: "priya", label: "Priya (Indian English)", voice: "Priya", language: "en-IN" },
  { key: "arjun", label: "Arjun (Indian English)", voice: "Arjun", language: "en-IN" },
  { key: "rachel", label: "Rachel (US English)", voice: "Rachel", language: "en-US" },
];

export function AnswerDisplayCard({
  answerData,
  isLoading,
  speechControl,
}: AnswerDisplayCardProps) {
  const {
    isSpeaking,
    speak,
    cancelSpeaking,
    supported: speechSupported,
  } = speechControl;

  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Voice selection state
  const [selectedVoiceKey, setSelectedVoiceKey] = useState(VOICES[0].key);
  const selectedVoice = VOICES.find(v => v.key === selectedVoiceKey) || VOICES[0];

  // Auto-generate audio when answer changes
  useEffect(() => {
    let active = true;
    async function generateAudio() {
      if (!answerData || !answerData.answer) {
        setAudioUrl(null);
        return;
      }
      setAudioLoading(true);
      setAudioError(null);
      try {
        // No external TTS API call; use browser TTS fallback in catch below
        setAudioUrl(null);
        // Optionally, you could trigger browser TTS here:
        // if (speechSupported && answerData.answer) speak(answerData.answer);
      
      } catch (e) {
        setAudioError("Failed to generate audio. Falling back to browser TTS.");
        setAudioUrl(null);
        // Optionally fallback to browser TTS
        if (speechSupported && answerData.answer) {
          speak(answerData.answer);
        }
      } finally {
        setAudioLoading(false);
      }
    }
    generateAudio();
    return () => {
      active = false;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerData, selectedVoiceKey]);

  // Manual replay handler
  const handleAudioReplay = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } else if (speechSupported && answerData?.answer) {
      speak(answerData.answer);
    }
  };

  // Radio group for voice selection
  const VoicePicker = (
    <div className="mb-2">
      <label className="block text-xs font-semibold text-blue-900 dark:text-blue-300 mb-1">Voice</label>
      <RadioGroup
        value={selectedVoiceKey}
        onValueChange={setSelectedVoiceKey}
        className="flex flex-row gap-4"
      >
        {VOICES.map(v => (
          <div key={v.key} className="flex items-center gap-1">
            <RadioGroupItem value={v.key} id={`voice-${v.key}`} />
            <label htmlFor={`voice-${v.key}`} className="text-sm cursor-pointer">
              {v.label}
            </label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-primary animate-pulse" />
            Generating Answer...
          </CardTitle>
          <CardDescription>
            Please wait while the AI processes your query.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-40 w-full" />{" "}
          {/* Placeholder for potential image */}
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
          <p className="text-muted-foreground">
            Your answer will appear here once you submit a question.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isError =
    answerData.answer.toLowerCase().includes("error") ||
    answerData.answer.toLowerCase().includes("sorry");

  return (
    <Card className="mobile-card glass w-full max-w-xl mx-auto mb-8 p-0 overflow-visible shadow-2xl dark:text-slate-100">
      <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
          {isError ? (
            <AlertCircle className="w-7 h-7 text-red-500" />
          ) : (
            <BrainCircuit className="w-7 h-7 text-indigo-600" />
          )}
          <CardTitle className="text-lg font-extrabold text-blue-900 dark:text-blue-300 tracking-tight">
            AI Response
          </CardTitle>
        </div>
        {answerData && answerData.answer && !isError && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleAudioReplay}
              aria-label="Replay answer audio"
              className="bg-white/80 hover:bg-blue-50 border-0 shadow-none"
              disabled={audioLoading}
            >
              {audioLoading ? (
                <span className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full" />
              ) : (
                <Volume2 className="w-5 h-5 text-indigo-600" />
              )}
            </Button>
            {(isSpeaking || (audioRef.current && !audioRef.current.paused)) && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (audioRef.current && !audioRef.current.paused) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                  }
                  cancelSpeaking();
                }}
                aria-label="Stop voice playback"
                className="bg-white/80 hover:bg-red-50 border-0 shadow-none"
              >
                <VolumeX className="w-5 h-5 text-red-500" />
              </Button>
            )}
            {audioUrl && (
              <audio ref={audioRef} src={audioUrl} hidden preload="auto" />
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {isError ? (
          <Alert variant="destructive" className="rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{answerData.answer}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            {VoicePicker}
            {audioError && (
              <div className="text-xs mb-2" style={{ color: '#2563eb' }}>{audioError}</div>
            )}
            <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 text-blue-900 px-6 py-4 shadow-inner break-words font-sans text-base leading-relaxed border border-indigo-100">
              <p className="whitespace-pre-line font-medium text-lg">
                {answerData.answer}
              </p>
            </div>
            {answerData.generatedImageUri && (
              <div className="mt-4 p-4 border rounded-xl bg-secondary/30 shadow-lg">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <ImageIcon className="w-4 h-4" />
                  Generated Image:
                </h3>
                <div className="relative w-full aspect-video overflow-hidden rounded-md shadow-md">
                  <Image
                    src={answerData.generatedImageUri}
                    alt="Generated visual representation"
                    layout="fill"
                    objectFit="contain"
                    data-ai-hint="graph data"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Image generated by AI based on document content.
                </p>
              </div>
            )}
            {answerData.sources && answerData.sources.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  Sources:
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {answerData.sources.map((source, index) => (
                    <li key={index} className="truncate">
                      {source}
                    </li>
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
