"use client";

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, Image as ImageIcon, FileAudio, Sheet, XCircle, UploadCloud } from "lucide-react";

interface FileUploadCardProps {
  onFileChange: (file: { name: string; type: string; dataUri: string } | null) => void;
  currentFile: { name: string; type: string; dataUri: string } | null;
}

const MAX_FILE_SIZE_MB = 60; // Increased to 60MB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ACCEPTED_FILE_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
};
const ALL_ACCEPTED_EXTENSIONS = Object.values(ACCEPTED_FILE_TYPES).flat().join(',');
const ALL_ACCEPTED_MIMES = Object.keys(ACCEPTED_FILE_TYPES).join(',');


export function FileUploadCard({ onFileChange, currentFile }: FileUploadCardProps) {
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "File too large",
        description: `Please upload a file smaller than ${MAX_FILE_SIZE_MB} MB.`,
        variant: "destructive",
      });
      return;
    }

    if (!Object.keys(ACCEPTED_FILE_TYPES).includes(file.type)) {
       const isAcceptedExtension = Object.values(ACCEPTED_FILE_TYPES).flat().some(ext => file.name.toLowerCase().endsWith(ext));
       if (!isAcceptedExtension) {
        toast({
            title: "Invalid file type",
            description: `Please upload one of the supported file types: ${Object.values(ACCEPTED_FILE_TYPES).flat().join(', ')}.`,
            variant: "destructive",
        });
        return;
       }
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        try {
          if (file.type === 'text/csv') {
            const csvContent = atob((e.target.result as string).split(',')[1] || '');
            if (!csvContent.trim()) {
              toast({
                title: "CSV Error",
                description: "The uploaded CSV file appears empty or invalid.",
                variant: "destructive",
              });
              return;
            }

            // PapaParse streaming parse with limits
            let rowCount = 0;
            let columnCount = 0;
            let parseError = null;
            let parseAborted = false;
            const MAX_ROWS = 10000;
            const MAX_COLS = 1000;
            const start = Date.now();
            Papa.parse(csvContent, {
              header: true,
              worker: false,
              step: function(row, parser) {
                if (rowCount === 0) {
                  columnCount = Object.keys(row.data).length;
                  if (columnCount > MAX_COLS) {
                    parseError = `CSV has too many columns (${columnCount}). Limit is ${MAX_COLS}.`;
                    parser.abort();
                    parseAborted = true;
                    return;
                  }
                }
                rowCount++;
                if (rowCount > MAX_ROWS) {
                  parseError = `CSV has too many rows (${rowCount}). Limit is ${MAX_ROWS}.`;
                  parser.abort();
                  parseAborted = true;
                  return;
                }
                if (Date.now() - start > 5000) {
                  parseError = `CSV parsing took too long. Please upload a smaller or simpler file.`;
                  parser.abort();
                  parseAborted = true;
                  return;
                }
              },
              complete: function() {
                if (parseError) {
                  toast({
                    title: "CSV Error",
                    description: parseError,
                    variant: "destructive",
                  });
                  return;
                }
                onFileChange({
                  name: file.name,
                  type: file.type,
                  dataUri: e.target.result as string,
                });
                toast({
                  title: "File uploaded",
                  description: `${file.name} has been successfully uploaded.`,
                });
              },
              error: function(err) {
                toast({
                  title: "CSV Parsing Error",
                  description: err.message || "Failed to parse CSV file.",
                  variant: "destructive",
                });
              }
            });
            if (parseAborted) return;
          } else {
            onFileChange({
              name: file.name,
              type: file.type,
              dataUri: e.target.result as string,
            });
            toast({
              title: "File uploaded",
              description: `${file.name} has been successfully uploaded.`,
            });
          }
        } catch (err) {
          toast({
            title: "File processing error",
            description: "There was a problem reading or parsing your file.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "File read error",
          description: "Could not read the selected file.",
          variant: "destructive",
        });
      }
    };

    reader.onerror = () => {
      toast({
        title: "File read error",
        description: "Could not read the selected file. Please try again or use a different file.",
        variant: "destructive",
      });
      onFileChange(null);
    };

    reader.readAsDataURL(file);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    event.target.value = ''; // Reset input to allow re-uploading the same file
  };
  
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleFileSelect(event.dataTransfer.files[0]);
      event.dataTransfer.clearData();
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-6 h-6 text-primary" />;
    if (fileType.startsWith('audio/')) return <FileAudio className="w-6 h-6 text-primary" />;
    if (fileType === 'text/csv') return <Sheet className="w-6 h-6 text-primary" />;
    if (fileType === 'application/pdf' || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return <FileText className="w-6 h-6 text-primary" />;
    }
    return <FileText className="w-6 h-6 text-primary" />;
  };

  return (
    <Card 
      className={`transition-all ${dragOver ? 'border-primary ring-2 ring-primary' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="w-6 h-6 text-primary" />
          Upload File
        </CardTitle>
        <CardDescription>Upload a file for analysis (max {MAX_FILE_SIZE_MB}MB). Supported: CSV, DOCX, PDF, Images, Audio.</CardDescription>
      </CardHeader>
      <CardContent>
        {currentFile ? (
          <div className="space-y-3 p-4 border rounded-md bg-secondary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getFileIcon(currentFile.type)}
                <span className="font-medium truncate max-w-[200px]">{currentFile.name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onFileChange(null)} aria-label="Remove file">
                <XCircle className="w-5 h-5 text-destructive" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Type: {currentFile.type}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md hover:border-primary transition-colors">
            <UploadCloud className="w-12 h-12 text-muted-foreground mb-2" />
            <p className="mb-2 text-sm text-muted-foreground">
              <label htmlFor="file-upload" className="font-semibold text-primary cursor-pointer hover:underline">
                Click to upload
              </label>
              {' '}or drag and drop
            </p>
            <Input
              id="file-upload"
              type="file"
              className="hidden"
              accept={`${ALL_ACCEPTED_MIMES},${ALL_ACCEPTED_EXTENSIONS}`}
              onChange={handleInputChange}
            />
            <p className="text-xs text-muted-foreground">Supported types: CSV, DOCX, PDF, PNG, JPG, MP3, WAV</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
