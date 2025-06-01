import React from 'react';
import { Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileManagerProps {
  fileName: string;
  onDelete: () => void;
  onReupload: () => void;
  className?: string;
}

// Version 1.0: Initial file management implementation
export function FileManager({
  fileName,
  onDelete,
  onReupload,
  className
}: FileManagerProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <p className="text-sm text-muted-foreground flex-1 truncate" title={fileName}>
        {fileName}
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReupload}
        className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
      >
        <Upload className="h-4 w-4 mr-1" />
        Re-upload
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Delete
      </Button>
    </div>
  );
}
