"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import JSZip from "jszip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Image as ImageIcon,
  FileAudio,
  Sheet,
  XCircle,
  UploadCloud,
} from "lucide-react";

interface FileUploadCardProps {
  onFileChange: (
    file: {
      name: string;
      type: string;
      dataUri: string;
      preview?: string;
    } | null,
  ) => void;
  currentFile: {
    name: string;
    type: string;
    dataUri: string;
    preview?: string;
  } | null;
}

const MAX_FILE_SIZE_MB = 1024; // Increased to 60MB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ACCEPTED_FILE_TYPES = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],

  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],

  "text/plain": [".txt"],
  "application/json": [".json"],
  "application/zip": [".zip"],
};
const ALL_ACCEPTED_EXTENSIONS = Object.values(ACCEPTED_FILE_TYPES)
  .flat()
  .join(",");
const ALL_ACCEPTED_MIMES = Object.keys(ACCEPTED_FILE_TYPES).join(",");

export function FileUploadCard({
  onFileChange,
  currentFile,
}: FileUploadCardProps) {
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedImages, setExtractedImages] = useState<string[]>([]); // v1.3 modular image gallery

  const processImageWithOCR = async (dataUri: string): Promise<string> => {
    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUri }),
      });
      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error("OCR processing failed:", error);
      return "";
    }
  };

  const generatePreview = async (
    file: File,
    dataUri: string,
  ): Promise<string> => {
    if (file.type.startsWith("image/")) {
      return dataUri; // Use the image directly as preview
    }
    if (file.type === "application/pdf") {
      // TODO: Implement PDF preview using pdf.js
      return "";
    }
    if (file.type === "text/plain" || file.type === "application/json") {
      const text = await file.text();
      return text.slice(0, 1000); // First 1000 characters as preview
    }
    return "";
  };

  // Modular v1.4: Browser PDF image extraction utility
  const extractImagesFromPDF = async (file: File): Promise<string[]> => {
    let pdfjsLib;
    try {
      pdfjsLib = await import("pdfjs-dist/build/pdf");
    } catch (err) {
      pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
    }
    // @ts-ignore
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const ops = await page.getOperatorList();
      const objs = page.objs;
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
          const imgName = ops.argsArray[i][0];
          const imgObj = objs.get(imgName);
          if (imgObj && imgObj.src) {
            images.push(imgObj.src);
          }
        }
      }
    }
    return images.filter(Boolean);
  };

  // Modular v1.5: Utilities for extracting text from XLSX, DOCX, TXT, ZIP
  const extractTextFromXLSX = async (file: File): Promise<string> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    let text = "";
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      text += `Sheet: ${sheetName}\n${csv}\n`;
    });
    return text.slice(0, 5000); // Limit preview/LLM input
  };

  const extractTextFromDOCX = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value.slice(0, 5000); // Limit preview/LLM input
  };

  const extractTextFromTXT = async (file: File): Promise<string> => {
    const text = await file.text();
    return text.slice(0, 5000);
  };

  const extractTextFromZIP = async (file: File): Promise<string> => {
    if (file.size > 200 * 1024 * 1024) {
      throw new Error(
        "ZIP file is too large for browser extraction. Please use a ZIP smaller than 200MB or split your archive.",
      );
    }
    try {
      const data = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(data);
      let text = "";
      let fileCount = 0;
      for (const filename of Object.keys(zip.files)) {
        const entry = zip.files[filename];
        if (!entry.dir && fileCount < 10) {
          const content = await entry.async("string");
          text += `File: ${filename}\n${content.slice(0, 1000)}\n---\n`;
          fileCount++;
        }
      }
      return text.slice(0, 5000);
    } catch (err) {
      throw new Error(
        "Failed to extract ZIP file. Try a smaller ZIP or contact support.",
      );
    }
  };

  const handleFileSelect = async (file: File | null) => {
    setExtractedImages([]); // Reset gallery for new file

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
      const isAcceptedExtension = Object.values(ACCEPTED_FILE_TYPES)
        .flat()
        .some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!isAcceptedExtension) {
        toast({
          title: "Invalid file type",
          description: `Please upload one of the supported file types: ${Object.values(ACCEPTED_FILE_TYPES).flat().join(", ")}.`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const processFile = async () => {
        if (e.target?.result) {
          try {
            // Only check for empty file if CSV, no parsing
            if (file.type === "text/csv") {
              const csvContent = atob(
                (e.target.result as string).split(",")[1] || "",
              );
              if (!csvContent.trim()) {
                toast({
                  title: "CSV Error",
                  description:
                    "The uploaded CSV file appears empty or invalid.",
                  variant: "destructive",
                });
                setIsUploading(false);
                return;
              }
            }
            let preview = "";
            let extractedText = "";
            // Modular v1.5: Handle file type for preview and Gemini
            if (
              file.type ===
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ) {
              extractedText = await extractTextFromXLSX(file);
              preview = extractedText.slice(0, 1000);
            } else if (
              file.type ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ) {
              extractedText = await extractTextFromDOCX(file);
              preview = extractedText.slice(0, 1000);
            } else if (file.type === "text/plain") {
              extractedText = await extractTextFromTXT(file);
              preview = extractedText.slice(0, 1000);
            } else if (file.type === "application/zip") {
              extractedText = await extractTextFromZIP(file);
              preview = extractedText.slice(0, 1000);
            } else if (
              file.type.startsWith("image/") ||
              file.type === "application/pdf"
            ) {
              preview = await generatePreview(file, e.target.result as string);
              if (
                file.type.startsWith("image/") ||
                file.type === "application/pdf"
              ) {
                extractedText = await processImageWithOCR(
                  e.target.result as string,
                );
              }
            } else {
              preview = await generatePreview(file, e.target.result as string);
            }
            onFileChange({
              name: file.name,
              type: file.type,
              dataUri: e.target.result as string,
              preview: preview || extractedText,
            });

            // Modular v1.5: Image extraction only for PDF/DOCX
            if (file.type === "application/pdf") {
              try {
                const pdfImages = await extractImagesFromPDF(file);
                setExtractedImages(pdfImages);
              } catch (err) {
                setExtractedImages([]);
                toast({
                  title: "PDF image extraction error",
                  description: "Could not extract images from this PDF.",
                  variant: "destructive",
                });
              }
            } else if (
              file.type ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ) {
              try {
                const res = await fetch("/api/extract-images", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    file: e.target.result,
                    fileType: file.type,
                  }),
                });
                const data = await res.json();
                if (Array.isArray(data.images) && data.images.length > 0) {
                  setExtractedImages(data.images);
                } else {
                  setExtractedImages([]);
                }
              } catch (err) {
                setExtractedImages([]);
                toast({
                  title: "DOCX image extraction error",
                  description: "Could not extract images from this DOCX.",
                  variant: "destructive",
                });
              }
            }
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
      processFile();
    };

    reader.onerror = () => {
      setIsUploading(false);
      toast({
        title: "File read error",
        description:
          "Could not read the selected file. Please try again or use a different file.",
        variant: "destructive",
      });
      onFileChange(null);
    };

    reader.readAsDataURL(file);
  };

  const handleInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleFileSelect(file);
    }
    event.target.value = ""; // Reset input to allow re-uploading the same file
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      await handleFileSelect(event.dataTransfer.files[0]);

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
    if (fileType.startsWith("image/"))
      return <ImageIcon className="w-6 h-6 text-primary" />;
    if (fileType.startsWith("audio/"))
      return <FileAudio className="w-6 h-6 text-primary" />;
    if (fileType === "text/csv")
      return <Sheet className="w-6 h-6 text-primary" />;
    if (
      fileType === "application/pdf" ||
      fileType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return <FileText className="w-6 h-6 text-primary" />;
    }
    return <FileText className="w-6 h-6 text-primary" />;
  };

  return (
    <Card
      className={`w-full max-w-xl mx-auto bg-white/90 shadow-lg rounded-2xl border-0 transition-all ${dragOver ? "ring-2 ring-blue-400" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <CardHeader className="px-6 pt-6 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-blue-900">
          <UploadCloud className="w-7 h-7 text-indigo-600" />
          Upload File
        </CardTitle>
        <CardDescription className="text-blue-900/70">
          Upload a file for analysis (max {MAX_FILE_SIZE_MB}MB). Supported: CSV,
          XLSX, DOCX, TXT, PDF, Images, Audio, ZIP.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="space-y-3">
          {/* Modular v1.3: Image gallery for PDF/DOCX */}
          <div className="my-4">
            <div className="font-semibold mb-2 text-blue-900">
              Extracted Images
            </div>
            {extractedImages.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {extractedImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="border rounded-lg bg-white/80 p-2 shadow max-w-[140px] max-h-[140px] flex items-center justify-center"
                  >
                    {img ? (
                      <img
                        src={img}
                        alt={`Extracted ${idx + 1}`}
                        className="object-contain max-h-[120px] max-w-[120px]"
                      />
                    ) : (
                      <span className="text-xs text-gray-400">
                        Image not available
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic">
                No images extracted from this file.
              </div>
            )}
          </div>
          {/* End modular v1.3 */}
          {currentFile && (
            <div className="flex items-center justify-between mb-2 bg-blue-50 rounded-full px-4 py-2 shadow-sm">
              <div className="flex flex-col w-full">
                <div className="flex items-center gap-3 mb-2">
                  {getFileIcon(currentFile.type)}
                  <span className="font-medium truncate max-w-[200px] text-blue-900">
                    {currentFile.name}
                  </span>
                </div>
                <div className="mt-2 p-2 bg-white/50 rounded-lg text-sm text-blue-900 max-h-32 overflow-y-auto">
                  {currentFile.preview ? (
                    currentFile.type.startsWith("image/") ? (
                      <img
                        src={currentFile.preview}
                        alt="Preview"
                        className="max-h-28 object-contain mx-auto"
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap text-xs">
                        {currentFile.preview}
                      </pre>
                    )
                  ) : (
                    <span className="text-xs text-gray-400 italic">
                      No preview available for this file.
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onFileChange(null)}
                aria-label="Remove file"
                className="hover:bg-red-50"
              >
                <XCircle className="w-5 h-5 text-red-500" />
              </Button>
            </div>
          )}
          {currentFile && (
            <p className="text-xs text-blue-900/70">Type: {currentFile.type}</p>
          )}
          <div className="flex flex-col items-center justify-center p-8 bg-indigo-50 rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-colors mt-2 w-full">
            <UploadCloud className="w-14 h-14 text-indigo-200 mb-2" />
            <p className="mb-2 text-base text-blue-900/70">
              <label
                htmlFor="file-upload"
                className="font-semibold text-indigo-700 cursor-pointer hover:underline"
              >
                Click to upload
              </label>{" "}
              or drag and drop
            </p>
            <Input
              id="file-upload"
              type="file"
              className="hidden"
              accept={`${ALL_ACCEPTED_MIMES},${ALL_ACCEPTED_EXTENSIONS}`}
              onChange={handleInputChange}
              disabled={isUploading}
            />

            <p className="text-xs text-indigo-400">
              Supported types: CSV, XLSX, DOCX, TXT, PDF, PNG, JPG, MP3, WAV
            </p>
            {isUploading && (
              <div className="flex flex-col items-center mt-2">
                <svg
                  className="animate-spin h-6 w-6 text-indigo-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
                <span className="text-xs text-indigo-400 mt-1">
                  Uploading/Parsing...
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
