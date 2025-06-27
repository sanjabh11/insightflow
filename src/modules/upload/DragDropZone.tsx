import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { UploadCloud } from "lucide-react";

interface DragDropZoneProps {
  onFileDrop: (file: File) => void;
  acceptedTypes?: string[];
  children?: React.ReactNode;
  className?: string;
}

// Version 1.0: Initial drag and drop implementation with visual feedback
export function DragDropZone({
  onFileDrop,
  acceptedTypes = [],
  children,
  className,
}: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (acceptedTypes.length === 0 || acceptedTypes.includes(file.type)) {
          onFileDrop(file);
        }
        e.dataTransfer.clearData();
      }
    },
    [acceptedTypes, onFileDrop],
  );

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-dashed transition-colors",
        isDragging
          ? "border-primary bg-primary/5 dark:bg-primary/10"
          : "border-muted-foreground/25 hover:border-primary/50",
        className,
      )}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/5 dark:bg-primary/10 rounded-lg">
          <div className="text-center">
            <UploadCloud className="mx-auto h-12 w-12 text-primary" />
            <p className="mt-2 text-sm text-primary font-medium">
              Drop to upload
            </p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
