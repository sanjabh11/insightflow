import { useState, useEffect } from 'react';
import { read as readXLSX, utils as xlsxUtils } from 'xlsx';
import JSZip from 'jszip';
import { useToast } from '@/hooks/use-toast';

interface FilePreviewProps {
  file: File | null;
  maxPreviewSize?: number; // in bytes
}

// Version 1.0: Initial file preview implementation
export function FilePreview({ file, maxPreviewSize = 1024 * 1024 * 2 }: FilePreviewProps) {
  const { toast } = useToast();
  const [previewContent, setPreviewContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const previewFile = async (file: File) => {
    setIsLoading(true);
    try {
      if (file.size > maxPreviewSize) {
        toast({
          title: 'File too large for preview',
          description: 'Only the first 2MB will be shown in the preview.',
          variant: 'default',
        });
      }

      let content = '';
      const fileType = file.type.toLowerCase();
      const fileName = file.name.toLowerCase();

      // Handle different file types
      if (fileType === 'application/json' || fileName.endsWith('.json')) {
        content = await previewJSON(file);
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        fileName.endsWith('.xlsx')
      ) {
        content = await previewXLSX(file);
      } else if (fileType === 'application/zip' || fileName.endsWith('.zip')) {
        content = await previewZIP(file);
      } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        content = await previewText(file);
      } else {
        content = 'Preview not available for this file type.';
      }

      setPreviewContent(content);
    } catch (error) {
      console.error('Error previewing file:', error);
      toast({
        title: 'Preview Error',
        description: 'Failed to generate preview for this file.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Preview handlers for different file types
  const previewJSON = async (file: File): Promise<string> => {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch {
      throw new Error('Invalid JSON file');
    }
  };

  const previewXLSX = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const workbook = readXLSX(buffer);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsxUtils.sheet_to_json(firstSheet);
    return JSON.stringify(data, null, 2);
  };

  const previewZIP = async (file: File): Promise<string> => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    const files = Object.keys(contents.files).map(name => ({
      name,
    }));
    return JSON.stringify(files, null, 2);
  };

  const previewText = async (file: File): Promise<string> => {
    return await file.text();
  };

  // Effect to preview file when it changes
  useEffect(() => {
    if (file) {
      previewFile(file);
    } else {
      setPreviewContent('');
    }
  }, [file]);

  if (!file) return null;

  return (
    <div className="w-full">
      {file && (
        <div className="mb-4 p-2 bg-blue-50 text-blue-900 rounded flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{file.name}</span>
            <span className="text-xs text-blue-600">({(file.size / 1024).toFixed(1)} KB)</span>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        previewContent && (
          <div className="p-4 border rounded-lg bg-background overflow-auto max-h-[400px]">
            <pre className="text-xs whitespace-pre-wrap">{previewContent}</pre>
          </div>
        )
      )}
    </div>
  );
}
