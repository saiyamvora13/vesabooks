import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FileWithDescription {
  file: File;
  description: string;
}

interface FileUploadWithDescriptionsProps {
  value: FileWithDescription[];
  onChange: (files: FileWithDescription[]) => void;
  accept: string;
  maxFiles: number;
  maxSize: number; // in bytes
  className?: string;
  "data-testid"?: string;
}

export function FileUploadWithDescriptions({
  value,
  onChange,
  accept,
  maxFiles,
  maxSize,
  className,
  "data-testid": testId,
}: FileUploadWithDescriptionsProps) {
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

    // Convert to FileWithDescription objects
    const filesWithDescriptions: FileWithDescription[] = validFiles.map(file => ({
      file,
      description: "",
    }));

    // Combine with existing files, respecting max limit
    const combinedFiles = [...value, ...filesWithDescriptions];
    const limitedFiles = combinedFiles.slice(0, maxFiles);
    
    onChange(limitedFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = value.filter((_, i) => i !== index);
    onChange(newFiles);
  };

  const updateDescription = (index: number, description: string) => {
    const newFiles = [...value];
    newFiles[index] = { ...newFiles[index], description };
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
          "upload-zone border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center bg-muted/20 cursor-pointer transition-all min-h-[120px] flex flex-col items-center justify-center",
          isDragOver ? "drag-over border-primary bg-primary/5" : "border-border"
        )}
      >
        <i className="fas fa-cloud-upload-alt text-3xl sm:text-4xl text-primary mb-3"></i>
        <p className="text-sm sm:text-base font-medium mb-1">Drop character images here</p>
        <p className="text-sm sm:text-sm text-muted-foreground mb-2">or tap to browse</p>
        <p className="text-xs sm:text-xs text-muted-foreground px-4">
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

      {/* Image Previews with Description Inputs */}
      {value.length > 0 && (
        <div className="space-y-4">
          {value.map((item, index) => (
            <div key={index} className="relative bg-muted/20 rounded-xl p-3 sm:p-4 border border-border">
              <div className="flex gap-3 sm:gap-4 items-start">
                {/* Image Preview */}
                <div className="relative group flex-shrink-0">
                  <img
                    src={URL.createObjectURL(item.file)}
                    alt={`Character ${index + 1}`}
                    className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border-2 border-border"
                    loading="lazy"
                  />
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 p-0 bg-destructive text-destructive-foreground rounded-full shadow-lg"
                    data-testid={`button-remove-image-${index}`}
                  >
                    <i className="fas fa-times text-xs"></i>
                  </Button>
                </div>

                {/* Description Input */}
                <div className="flex-grow space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <i className="fas fa-user text-primary"></i>
                    Character {index + 1} Description
                    <span className="text-muted-foreground font-normal text-xs">(e.g., "Mom - a woman in her 30s with curly brown hair")</span>
                  </label>
                  <Input
                    type="text"
                    placeholder={`Describe this character (e.g., "Dad - tall man with glasses" or "Child - 5-year-old girl")`}
                    value={item.description}
                    onChange={(e) => updateDescription(index, e.target.value)}
                    className="rounded-lg"
                    style={{
                      fontSize: '16px', // Prevents zoom on iOS
                    }}
                    data-testid={`input-character-description-${index}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    <i className="fas fa-lightbulb mr-1"></i>
                    This helps the AI know who is who in your story
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
