import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, Image as ImageIcon, Upload, X, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ImageUploadProps {
  imageUrl?: string | null;
  onImageChange: (imageUrl: string | null) => void;
  className?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  imageUrl,
  onImageChange,
  className = ""
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, etc.)');
      setIsUploading(false);
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      setIsUploading(false);
      return;
    }

    try {
      const base64String = await convertToBase64(file);
      onImageChange(base64String);
    } catch (error) {
      setError('Failed to process image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
    // Reset input value to allow selecting the same file again
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

  const removeImage = () => {
    onImageChange(null);
    setError(null);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <Label className="text-sm font-medium">Key Bunch Photo</Label>
      
      {imageUrl ? (
        <div className="space-y-2">
          <div className="relative inline-block">
            <img
              src={imageUrl}
              alt="Key bunch"
              className="w-full max-w-[200px] h-32 object-cover rounded-lg border border-gray-300"
            />
            <div className="absolute top-1 right-1 flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-6 w-6 p-0 bg-white/80 hover:bg-white"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-6 w-6 p-0 bg-red-500/80 hover:bg-red-500"
                onClick={removeImage}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500">Click the eye to view full size, or X to remove</p>
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
              <ImageIcon className="w-full h-full" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">
                Add a photo of the key bunch
              </p>
              <p className="text-xs text-gray-500">
                Drag and drop, or click to select from gallery/camera
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-8 px-3 text-xs"
              >
                <ImageIcon className="h-3 w-3 mr-1" />
                Gallery
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploading}
                className="h-8 px-3 text-xs"
              >
                <Camera className="h-3 w-3 mr-1" />
                Camera
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {isUploading && (
        <Alert>
          <Upload className="h-4 w-4" />
          <AlertDescription>Uploading image...</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Image preview modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Key Bunch Photo</DialogTitle>
            <DialogDescription>
              Full-size preview of the key bunch photo.
            </DialogDescription>
          </DialogHeader>
          {imageUrl && (
            <div className="flex justify-center">
              <img
                src={imageUrl}
                alt="Key bunch full size"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageUpload;