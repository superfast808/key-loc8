import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Nfc, 
  Zap, 
  Smartphone, 
  Wifi, 
  CheckCircle, 
  RotateCcw,
  AlertCircle 
} from "lucide-react";

interface NFCBulkAuditScannerProps {
  auditSession: any;
  expectedKeys: any[];
  onScanSuccess: (keyBunch: any) => void;
}

export function NFCBulkAuditScanner({ 
  auditSession, 
  expectedKeys, 
  onScanSuccess 
}: NFCBulkAuditScannerProps) {
  const [nfcSerial, setNfcSerial] = useState("");
  const [scannedKeys, setScannedKeys] = useState<Set<number>>(new Set());
  const [lastScannedKey, setLastScannedKey] = useState<any>(null);
  const [scanResult, setScanResult] = useState<'success' | 'error' | null>(null);
  const [isNFCSupported, setIsNFCSupported] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [nfcController, setNfcController] = useState<AbortController | null>(null);
  const { toast } = useToast();
  const scannerRef = useRef<HTMLDivElement>(null);

  // Check NFC support
  useEffect(() => {
    if ('NDEFReader' in window) {
      setIsNFCSupported(true);
    } else {
      setIsNFCSupported(false);
    }
  }, []);

  // Focus input after scan
  useEffect(() => {
    const input = document.getElementById('nfc-input');
    if (input) input.focus();
  }, [lastScannedKey]);

  // Get type colors and names
  const getBunchTypeColor = (type: string) => {
    switch (type) {
      case 'day_shift': return 'bg-blue-100 text-blue-800';
      case 'night_shift': return 'bg-purple-100 text-purple-800';
      case 'lock_ups': return 'bg-red-100 text-red-800';
      case 'static': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBunchTypeName = (type: string) => {
    switch (type) {
      case 'day_shift': return 'Day Shift';
      case 'night_shift': return 'Night Shift';
      case 'lock_ups': return 'Lock Ups';
      case 'static': return 'Static';
      default: return type;
    }
  };

  // NFC Scanning functionality
  const startNFCScanning = async () => {
    if (!isNFCSupported) {
      toast({
        title: "NFC Not Supported",
        description: "Your device doesn't support Web NFC API. Please use Chrome on Android or update your browser.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsScanning(true);
      const controller = new AbortController();
      setNfcController(controller);

      const ndefReader = new (window as any).NDEFReader();
      
      console.log('Starting NFC scan...');
      
      // Request NFC permission and start scanning
      await ndefReader.scan({ signal: controller.signal });
      
      console.log('NFC scan started successfully');
      
      toast({
        title: "NFC Scanner Active",
        description: "Hold your device near an NFC tag to scan. Make sure NFC is enabled in your device settings.",
        duration: 5000,
      });

      ndefReader.addEventListener("reading", ({ message, serialNumber }: any) => {
        console.log('NFC tag detected!', { 
          serialNumber,
          message,
          records: message?.records?.length || 0 
        });
        
        // Use the serial number as the NFC identifier, fallback to timestamp if not available
        let nfcId;
        if (serialNumber) {
          // Convert array buffer to hex string if needed
          if (serialNumber instanceof ArrayBuffer) {
            nfcId = Array.from(new Uint8Array(serialNumber))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
          } else {
            nfcId = serialNumber;
          }
        } else {
          // If no serial number, try to extract from message records
          nfcId = `nfc_${Date.now()}`;
        }
        
        console.log('Processing NFC ID:', nfcId);
        handleNFCScan(nfcId);
      });

      ndefReader.addEventListener("readingerror", (event: any) => {
        console.error('NFC reading error:', event);
        toast({
          title: "NFC Read Error",
          description: "Failed to read NFC tag. Make sure the tag is close to your device and try again.",
          variant: "destructive",
        });
      });

    } catch (error: any) {
      console.error('NFC scan error:', error);
      setIsScanning(false);
      
      let errorMessage = "Failed to start NFC scanning";
      if (error.name === 'NotAllowedError') {
        errorMessage = "NFC access denied. Please allow NFC permissions and try again.";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "NFC is not supported on this device or browser.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "NFC is not available. Please enable NFC in your device settings.";
      }
      
      toast({
        title: "NFC Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopNFCScanning = () => {
    if (nfcController) {
      nfcController.abort();
      setNfcController(null);
    }
    setIsScanning(false);
    toast({
      title: "NFC Scanner Stopped",
      description: "NFC scanning has been disabled",
    });
  };

  const handleNFCScan = (nfcId: string) => {
    console.log('Processing NFC scan:', nfcId);
    scanMutation.mutate(nfcId);
  };

  const scanMutation = useMutation({
    mutationFn: async (nfcSerial: string) => {
      return apiRequest('POST', '/api/audit/nfc-scan', {
        auditSessionId: auditSession.id,
        nfcSerial
      });
    },
    onSuccess: (data) => {
      const { keyBunch } = data;
      
      if (scannedKeys.has(keyBunch.id)) {
        toast({
          title: "Already Scanned",
          description: `${keyBunch.identifier} has already been scanned in this audit`,
          variant: "destructive",
        });
        setScanResult('error');
        return;
      }

      setScannedKeys(prev => new Set([...Array.from(prev), keyBunch.id]));
      setLastScannedKey(keyBunch);
      setScanResult('success');
      onScanSuccess(keyBunch);
      
      // Mobile haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }

      // Clear input for next scan
      setNfcSerial("");
    },
    onError: (error: any) => {
      setScanResult('error');
      
      // Mobile error haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      
      toast({
        title: "Scan Failed",
        description: error.message || "Key bunch not found for this NFC tag",
        variant: "destructive",
      });
    },
  });

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (nfcSerial.trim()) {
      scanMutation.mutate(nfcSerial.trim());
    }
  };

  const resetScanResult = () => {
    setScanResult(null);
    setLastScannedKey(null);
  };

  const scannedCount = scannedKeys.size;
  const totalExpected = expectedKeys.length;
  const progressPercentage = totalExpected > 0 ? Math.round((scannedCount / totalExpected) * 100) : 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Scan Progress - Mobile Optimized */}
      <div className="p-3 sm:p-4 bg-white rounded-lg border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <span className="flex items-center gap-2 font-medium text-sm sm:text-base">
            <Nfc className="h-4 w-4 sm:h-5 sm:w-5" />
            NFC Scan Progress
          </span>
          <Badge variant={progressPercentage === 100 ? "default" : "secondary"} className="text-xs sm:text-sm w-fit">
            {scannedCount} of {totalExpected} ({progressPercentage}%)
          </Badge>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 sm:h-2 mb-3">
          <div 
            className="bg-blue-600 h-3 sm:h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        {progressPercentage === 100 && (
          <div className="text-center">
            <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-green-600 mx-auto mb-2" />
            <p className="text-green-600 font-medium text-sm sm:text-base">All expected keys scanned!</p>
          </div>
        )}
      </div>

      {/* NFC Scanner - Mobile Optimized */}
      <div className="p-3 sm:p-4 bg-white rounded-lg border">
        <div className="flex items-center gap-2 font-medium mb-3 sm:mb-4 text-sm sm:text-base">
          <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
          NFC Scanner
        </div>
        
        {/* NFC Scanner Controls - Mobile Friendly */}
        {isNFCSupported && (
          <div className="mb-3 sm:mb-4">
            {!isScanning ? (
              <Button 
                onClick={startNFCScanning}
                className="w-full mb-3 h-12 sm:h-10 text-base sm:text-sm"
                variant="default"
              >
                <Smartphone className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
                Start NFC Scanning
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center p-4 sm:p-6 bg-blue-50 rounded-lg border-2 border-blue-200 border-dashed">
                  <div className="text-center">
                    <Wifi className="h-8 w-8 sm:h-6 sm:w-6 text-blue-600 mx-auto mb-2 animate-pulse" />
                    <div className="font-medium text-blue-800 text-base sm:text-sm">NFC Scanner Active</div>
                    <div className="text-sm sm:text-xs text-blue-600 mt-1">Hold device near NFC tags to scan</div>
                  </div>
                </div>
                <Button 
                  onClick={stopNFCScanning}
                  variant="outline"
                  className="w-full h-12 sm:h-10 text-base sm:text-sm"
                >
                  Stop NFC Scanning
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Scan Result - Mobile Optimized */}
        {scanResult && lastScannedKey && (
          <div className="mt-4 p-3 sm:p-4 rounded-lg border-2 border-dashed">
            {scanResult === 'success' ? (
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-green-800 text-base sm:text-sm">
                    Scan Successful!
                  </div>
                  <div className="text-sm sm:text-sm text-gray-600 mt-1">
                    <div className="font-medium truncate">{lastScannedKey.identifier}</div>
                    <div className="text-xs sm:text-xs text-gray-500">Seal: {lastScannedKey.currentTag}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={getBunchTypeColor(lastScannedKey.type) + " text-xs"}>
                        {getBunchTypeName(lastScannedKey.type)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 sm:h-5 sm:w-5 text-red-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <div className="font-medium text-red-800 text-base sm:text-sm">
                    Scan Failed
                  </div>
                  <div className="text-sm sm:text-sm text-gray-600 mt-1">
                    Key bunch not found for this NFC tag
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}