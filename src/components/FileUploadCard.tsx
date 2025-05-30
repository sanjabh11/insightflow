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
  const [isUploading, setIsUploading] = useState(false);

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

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        try {
          // Only check for empty file if CSV, no parsing
          if (file.type === 'text/csv') {
            const csvContent = atob((e.target.result as string).split(',')[1] || '');
            if (!csvContent.trim()) {
              toast({
                title: "CSV Error",
                description: "The uploaded CSV file appears empty or invalid.",
                variant: "destructive",
              });
              setIsUploading(false);
              return;
            }
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
      setIsUploading(false);
    };

    reader.onerror = () => {
      setIsUploading(false);
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
    <Card className={`w-full max-w-xl mx-auto bg-white/90 shadow-lg rounded-2xl border-0 transition-all ${dragOver ? 'ring-2 ring-blue-400' : ''}`} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
      <CardHeader className="px-6 pt-6 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-blue-900">
          <UploadCloud className="w-7 h-7 text-indigo-600" />
          Upload File
        </CardTitle>
        <CardDescription className="text-blue-900/70">Upload a file for analysis (max {MAX_FILE_SIZE_MB}MB). Supported: CSV, DOCX, PDF, Images, Audio.</CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="space-y-3">
          {currentFile && (
            <div className="flex items-center justify-between mb-2 bg-blue-50 rounded-full px-4 py-2 shadow-sm">
              <div className="flex items-center gap-3">
                {getFileIcon(currentFile.type)}
                <span className="font-medium truncate max-w-[200px] text-blue-900">{currentFile.name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onFileChange(null)} aria-label="Remove file" className="hover:bg-red-50">
                <XCircle className="w-5 h-5 text-red-500" />
              </Button>
            </div>
          )}
          {currentFile && <p className="text-xs text-blue-900/70">Type: {currentFile.type}</p>}
          <div className="flex flex-col items-center justify-center p-8 bg-indigo-50 rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-colors mt-2 w-full">
            <UploadCloud className="w-14 h-14 text-indigo-200 mb-2" />
            <p className="mb-2 text-base text-blue-900/70">
              <label htmlFor="file-upload" className="font-semibold text-indigo-700 cursor-pointer hover:underline">
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
              disabled={isUploading}
            />
            <p className="text-xs text-indigo-400">Supported types: CSV, DOCX, PDF, PNG, JPG, MP3, WAV</p>
            {isUploading && (
              <div className="flex flex-col items-center mt-2">
                <svg className="animate-spin h-6 w-6 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <span className="text-xs text-indigo-400 mt-1">Uploading/Parsing...</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
