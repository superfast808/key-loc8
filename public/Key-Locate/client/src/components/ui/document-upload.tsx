import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Upload, X } from "lucide-react";

interface DocumentUploadProps {
  documentUrl?: string | null;
  documentName?: string | null;
  onDocumentChange: (data: { documentUrl: string | null; documentName: string | null; documentType: string | null }) => void;
  className?: string;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documentUrl,
  documentName,
  onDocumentChange,
  className = ""
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const validateAndProcessFile = async (file: File) => {
    setError(null);
    setIsUploading(true);

    try {
      const base64String = await convertToBase64(file);
      onDocumentChange({
        documentUrl: base64String,
        documentName: file.name,
        documentType: file.type
      });
    } catch (error) {
      setError('Failed to process file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
    event.target.value = '';
  };

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      validateAndProcessFile(file);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const removeDocument = () => {
    onDocumentChange({
      documentUrl: null,
      documentName: null,
      documentType: null
    });
    setError(null);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <Label className="text-sm font-medium">Document</Label>
      
      {documentUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg bg-gray-50">
            <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{documentName || "Document"}</p>
              <p className="text-xs text-gray-500">Attached document</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 px-3 flex-shrink-0"
              onClick={removeDocument}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="space-y-3">
            <div className="mx-auto w-12 h-12 text-gray-400">
              <FileText className="w-full h-full" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">
                Upload Document
              </p>
              <p className="text-xs text-gray-500">
                PDF, Word, Excel, images and more
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-8 px-3 text-xs"
            >
              <FileText className="h-3 w-3 mr-1" />
              Select File
            </Button>
          </div>
        </div>
      )}

      {/* Hidden file input — accepts all file types */}
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {isUploading && (
        <Alert>
          <Upload className="h-4 w-4" />
          <AlertDescription>Uploading file...</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default DocumentUpload;
