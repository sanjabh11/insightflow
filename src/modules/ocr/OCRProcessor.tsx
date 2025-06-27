import { useState } from "react";
import {
  createWorker,
  Worker,
  WorkerParams,
  WorkerOptions,
} from "tesseract.js";
import { useToast } from "@/hooks/use-toast";

interface OCRProcessorProps {
  imageFile: File | null;
  onComplete: (text: string) => void;
  onError: (error: string) => void;
}

// Version 1.0: Initial OCR implementation
export function OCRProcessor({
  imageFile,
  onComplete,
  onError,
}: OCRProcessorProps) {
  const { toast } = useToast();
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const processImage = async () => {
    if (!imageFile) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const worker = await createWorker();

      (worker as any).logger = {
        logger: (m: WorkerParams) => {
          if (m.status === "recognizing text") {
            setProgress(parseInt(m.progress.toString()) * 100);
          }
        },
      };

      await (worker as any).loadLanguage("eng");
      await (worker as any).initialize("eng");

      const {
        data: { text },
      } = await worker.recognize(imageFile);
      await worker.terminate();

      if (text.trim()) {
        onComplete(text);
        toast({
          title: "OCR Complete",
          description: "Text has been successfully extracted from the image.",
        });
      } else {
        throw new Error("No text found in image");
      }
    } catch (error) {
      console.error("OCR Error:", error);
      onError(
        error instanceof Error ? error.message : "Failed to process image",
      );
      toast({
        title: "OCR Error",
        description: "Failed to extract text from the image.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  if (!imageFile) return null;

  return (
    <div className="mt-4">
      {isProcessing && (
        <div className="space-y-2">
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Processing image... {progress.toFixed(0)}%
          </p>
        </div>
      )}
    </div>
  );
}
