import React, { useEffect, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Lock, Download, FileText } from "lucide-react";

interface DocumentViewerProps {
  documentUrl: string;
  documentName?: string;
}

function getMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  return match ? match[1] : "";
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

function downloadFile(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ documentUrl, documentName }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mimeType = getMimeType(documentUrl);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('contextmenu', handleContextMenu);
      return () => {
        iframe.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, []);

  return (
    <div className="h-full w-full flex flex-col">
      <Alert className="mb-2 sm:mb-4 py-2 sm:py-3">
        <Lock className="h-3 w-3 sm:h-4 sm:w-4" />
        <AlertDescription className="text-xs sm:text-sm">
          {isPdf(mimeType) || isImage(mimeType)
            ? "View-only mode."
            : "This file type cannot be previewed in the browser."}
        </AlertDescription>
      </Alert>

      <div className="flex-1 w-full overflow-auto">
        {isPdf(mimeType) && (
          <iframe
            ref={iframeRef}
            src={`${documentUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            className="w-full h-full border border-gray-300 rounded-lg"
            title={documentName || "Secure Document"}
            style={{ minHeight: '400px', pointerEvents: 'auto' }}
          />
        )}

        {isImage(mimeType) && (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <img
              src={documentUrl}
              alt={documentName || "Document"}
              className="max-w-full max-h-full object-contain rounded-lg border border-gray-300"
            />
          </div>
        )}

        {!isPdf(mimeType) && !isImage(mimeType) && (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-center p-6">
            <FileText className="h-16 w-16 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                {documentName || "Document"}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                This file type cannot be previewed in the browser. Download it to view.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadFile(documentUrl, documentName || "document")}
              >
                <Download className="h-4 w-4 mr-2" />
                Download File
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;
