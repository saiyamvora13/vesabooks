import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  value: File[];
  onChange: (files: File[]) => void;
  accept: string;
  maxFiles: number;
  maxSize: number; // in bytes
  className?: string;
  "data-testid"?: string;
}

export function FileUpload({
  value,
  onChange,
  accept,
  maxFiles,
  maxSize,
  className,
  "data-testid": testId,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleFiles(files);
  };

  const handleFiles = (newFiles: File[]) => {
    // Filter valid files
    const validFiles = newFiles.filter(file => {
      const isValidType = accept.split(',').some(type => file.type === type.trim());
      const isValidSize = file.size <= maxSize;
      return isValidType && isValidSize;
    });

    // Combine with existing files, respecting max limit
    const combinedFiles = [...value, ...validFiles];
    const limitedFiles = combinedFiles.slice(0, maxFiles);
    
    onChange(limitedFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = value.filter((_, i) => i !== index);
    onChange(newFiles);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn("space-y-4", className)} data-testid={testId}>
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFilePicker}
        className={cn(
          "upload-zone border-2 border-dashed rounded-2xl p-8 text-center bg-muted/20 cursor-pointer transition-all",
          isDragOver ? "drag-over border-primary bg-primary/5" : "border-border"
        )}
      >
        <i className="fas fa-cloud-upload-alt text-4xl text-primary mb-3"></i>
        <p className="text-base font-medium mb-1">Drop your images here</p>
        <p className="text-sm text-muted-foreground mb-2">or click to browse</p>
        <p className="text-xs text-muted-foreground">
          PNG or JPEG • Max {formatFileSize(maxSize)} per image • {maxFiles} images max
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={accept}
          onChange={handleFileInput}
        />
      </div>

      {/* Image Previews */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {value.map((file, index) => (
            <div key={index} className="relative group">
              <img
                src={URL.createObjectURL(file)}
                alt={`Preview ${index + 1}`}
                className="w-full h-40 object-cover rounded-xl border-2 border-border"
              />
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 p-0 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-remove-image-${index}`}
              >
                <i className="fas fa-times text-xs"></i>
              </Button>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs px-2 py-1.5 rounded-b-xl text-center truncate">
                {file.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
