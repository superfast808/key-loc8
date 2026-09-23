import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Nfc, CheckCircle, XCircle, RotateCcw, Zap, Smartphone, AlertTriangle, Wifi } from "lucide-react";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";
import type { AuditSession, KeyBunch } from "@shared/schema";

interface NFCAuditScannerProps {
  auditSession: AuditSession;
  expectedKeys: KeyBunch[];
  onScanSuccess: (keyBunch: KeyBunch) => void;
  onComplete: () => void;
}

export function NFCAuditScanner({ 
  auditSession, 
  expectedKeys, 
  onScanSuccess, 
  onComplete 
}: NFCAuditScannerProps) {
  const [nfcSerial, setNfcSerial] = useState("");
  const [scannedKeys, setScannedKeys] = useState<Set<number>>(new Set());
  const [lastScannedKey, setLastScannedKey] = useState<KeyBunch | null>(null);
  const [scanResult, setScanResult] = useState<'success' | 'error' | null>(null);
  const [isNFCSupported, setIsNFCSupported] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [nfcController, setNfcController] = useState<AbortController | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scannerRef = useRef<HTMLDivElement>(null);
  const { getTypeDisplayName, getStatusDisplayName, getTypeColor, getStatusColor } = useSettingsHelpers();

  // Check NFC support and initialize
  useEffect(() => {
    const checkNFCSupport = async () => {
      console.log('Checking NFC support...');
      console.log('User agent:', navigator.userAgent);
      console.log('Is HTTPS:', window.location.protocol === 'https:');
      
      if ('NDEFReader' in window) {
        try {
          const ndefReader = new (window as any).NDEFReader();
          setIsNFCSupported(true);
          console.log('✅ NFC is supported - NDEFReader available');
          
          // Test permissions
          try {
            await navigator.permissions.query({ name: 'nfc' as any });
            console.log('✅ NFC permissions API available');
          } catch (e) {
            console.log('ℹ️ NFC permissions API not available, but NDEFReader exists');
          }
          
        } catch (error) {
          console.log('❌ NFC Reader creation failed:', error);
          setIsNFCSupported(false);
        }
      } else {
        console.log('❌ Web NFC API (NDEFReader) not available in this browser');
        console.log('ℹ️ Web NFC requires Chrome 89+ on Android with HTTPS');
        setIsNFCSupported(false);
      }
    };

    checkNFCSupport();
  }, []);

  // Auto-focus input on mount and after each scan
  useEffect(() => {
    const input = document.getElementById('nfc-input');
    if (input) input.focus();
  }, [lastScannedKey]);

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

      // Clear input for next scan
      setNfcSerial("");
    },
    onError: (error: any) => {
      setScanResult('error');
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
    <div className="space-y-6">
      {/* Scan Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Nfc className="h-5 w-5" />
              NFC Scan Progress
            </span>
            <Badge variant={progressPercentage === 100 ? "default" : "secondary"}>
              {scannedCount} of {totalExpected} ({progressPercentage}%)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          
          {progressPercentage === 100 && (
            <div className="text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-600 font-medium">All expected keys scanned!</p>
              <Button onClick={onComplete} className="mt-2">
                Complete Audit
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NFC Scanner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            NFC Scanner
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* NFC not supported message */}
          {isNFCSupported === false && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-1">NFC not available on this device or browser</p>
                <p className="text-sm text-gray-600">
                  Web NFC scanning requires <strong>Chrome on Android</strong> with NFC enabled in your device settings. It is not supported on iOS, desktop browsers, or other mobile browsers.
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  You can still mark keys as present manually using the checklist below.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* NFC Scanner Controls */}
          {isNFCSupported && (
            <div className="mb-4">
              {!isScanning ? (
                <Button 
                  onClick={startNFCScanning}
                  className="w-full mb-3"
                  variant="default"
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Start NFC Scanning
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200 border-dashed">
                    <div className="text-center">
                      <Wifi className="h-8 w-8 text-blue-600 mx-auto mb-2 animate-pulse" />
                      <div className="font-medium text-blue-800">NFC Scanner Active</div>
                      <div className="text-sm text-blue-600">Hold device near NFC tags to scan</div>
                    </div>
                  </div>
                  <Button 
                    onClick={stopNFCScanning}
                    variant="outline"
                    className="w-full"
                  >
                    Stop NFC Scanning
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Checking NFC support */}
          {isNFCSupported === null && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Wifi className="h-4 w-4 animate-pulse" />
              Checking NFC support...
            </div>
          )}

          {/* Scan Result */}
          {scanResult && lastScannedKey && (
            <div className="mt-4 p-4 rounded-lg border-2 border-dashed">
              {scanResult === 'success' ? (
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <div className="font-medium text-green-800">
                      Scan Successful!
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      <div className="font-medium">{lastScannedKey.identifier}</div>
                      <div>Seal: {lastScannedKey.currentTag}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge style={{ backgroundColor: getTypeColor(lastScannedKey.type) }}>
                          {getTypeDisplayName(lastScannedKey.type)}
                        </Badge>
                        <Badge style={{ backgroundColor: getStatusColor(lastScannedKey.status) }}>
                          {getStatusDisplayName(lastScannedKey.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <div className="font-medium text-red-800">
                      Scan Failed
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      No key bunch found for this NFC tag, or it may have been scanned already.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanned Keys List */}
      {scannedKeys.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scanned Keys ({scannedKeys.size})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {expectedKeys
                .filter(key => scannedKeys.has(key.id))
                .map(key => (
                  <div key={key.id} className="flex items-center justify-between p-2 bg-green-50 rounded border">
                    <div>
                      <div className="font-medium">{key.identifier}</div>
                      <div className="text-sm text-gray-600">{key.currentTag}</div>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing Keys (if any) */}
      {scannedKeys.size > 0 && scannedKeys.size < totalExpected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">
              Remaining Keys ({totalExpected - scannedKeys.size})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {expectedKeys
                .filter(key => !scannedKeys.has(key.id))
                .map(key => (
                  <div key={key.id} className="flex items-center justify-between p-2 bg-orange-50 rounded border">
                    <div>
                      <div className="font-medium">{key.identifier}</div>
                      <div className="text-sm text-gray-600">{key.currentTag}</div>
                    </div>
                    <XCircle className="h-5 w-5 text-orange-600" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}