import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Download, CheckCircle, XCircle, AlertCircle, FileSpreadsheet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AppSettings } from "@shared/settings";

interface ValidationError {
  row: number;
  errors: string[];
  data: any;
}

interface ValidationResult {
  valid: boolean;
  validatedRows: any[];
  errors: ValidationError[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
}

const BulkUpload = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const getTypeDisplayName = (typeId: string) => {
    if (!settings?.keyTypes) return typeId;
    const type = settings.keyTypes.find(t => t.id === typeId);
    return type?.displayName || type?.name || typeId;
  };

  const getStatusDisplayName = (statusId: string) => {
    if (!settings?.statuses) return statusId;
    const status = settings.statuses.find(s => s.id === statusId);
    return status?.displayName || status?.name || statusId;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file",
          variant: "destructive"
        });
        return;
      }
      setCsvFile(file);
      setValidationResult(null);
    }
  };

  // Normalize a string by removing special whitespace characters and trimming
  const normalizeString = (str: string): string => {
    return str
      .replace(/\u00A0/g, ' ') // Replace non-breaking spaces with regular spaces
      .replace(/\u200B/g, '') // Remove zero-width spaces
      .replace(/\uFEFF/g, '') // Remove zero-width no-break spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  };

  const parseCSV = (text: string): any[] => {
    // Normalize line endings to \n (handles Windows CRLF, Mac CR, Unix LF)
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.trim().split('\n');
    
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => normalizeString(h.replace(/"/g, '')));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(normalizeString(current));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(normalizeString(current));

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      // Skip completely empty rows (all values are empty strings or just punctuation)
      const hasAnyData = Object.values(row).some(value => {
        const trimmed = String(value).trim();
        // Check if value has any alphanumeric or meaningful characters
        return trimmed !== '' && trimmed !== ',' && /[a-zA-Z0-9]/.test(trimmed);
      });
      
      if (!hasAnyData) {
        console.log(`Skipping empty row at line ${i + 1}`);
      } else {
        rows.push(row);
      }
    }

    return rows;
  };

  const validateMutation = useMutation({
    mutationFn: async (csvData: any[]) => {
      return apiRequest("POST", "/api/key-bunches/csv/validate", { csvData });
    },
    onSuccess: (data: ValidationResult) => {
      setValidationResult(data);
      if (data.valid) {
        toast({
          title: "Validation successful",
          description: `All ${data.summary.total} rows are valid and ready to upload`,
        });
      } else {
        toast({
          title: "Validation found errors",
          description: `${data.summary.invalid} rows have errors that need to be fixed`,
          variant: "destructive"
        });
      }
    },
    onError: () => {
      toast({
        title: "Validation failed",
        description: "Failed to validate CSV file",
        variant: "destructive"
      });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (validatedRows: any[]) => {
      return apiRequest("POST", "/api/key-bunches/csv/upload", { validatedRows });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches", "all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Upload successful",
        description: `Successfully created ${data.created} key bunches`,
      });
      setCsvFile(null);
      setValidationResult(null);
      setIsUploading(false);
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to upload key bunches",
        variant: "destructive"
      });
      setIsUploading(false);
    }
  });

  // Decode CSV file with encoding fallback (UTF-8 → Windows-1252 → ISO-8859-1)
  const readCSVFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // Try UTF-8 first
        try {
          const decoder = new TextDecoder('utf-8', { fatal: true });
          let text = decoder.decode(arrayBuffer);
          
          // Strip BOM (Byte Order Mark) if present
          if (text.charCodeAt(0) === 0xFEFF) {
            text = text.slice(1);
          }
          
          console.log('CSV decoded successfully as UTF-8');
          resolve(text);
          return;
        } catch (e) {
          console.log('UTF-8 decoding failed, trying Windows-1252...');
        }
        
        // Fallback to Windows-1252
        try {
          const decoder = new TextDecoder('windows-1252', { fatal: true });
          let text = decoder.decode(arrayBuffer);
          
          // Strip BOM if present
          if (text.charCodeAt(0) === 0xFEFF) {
            text = text.slice(1);
          }
          
          console.log('CSV decoded successfully as Windows-1252');
          resolve(text);
          return;
        } catch (e) {
          console.log('Windows-1252 decoding failed, trying ISO-8859-1...');
        }
        
        // Final fallback to ISO-8859-1 (never fails)
        const decoder = new TextDecoder('iso-8859-1');
        let text = decoder.decode(arrayBuffer);
        
        // Strip BOM if present
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }
        
        console.log('CSV decoded as ISO-8859-1 (fallback)');
        resolve(text);
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleValidate = async () => {
    if (!csvFile) return;

    try {
      const text = await readCSVFile(csvFile);
      const csvData = parseCSV(text);
      validateMutation.mutate(csvData);
    } catch (error) {
      toast({
        title: "File reading failed",
        description: "Unable to read the CSV file. Please ensure it's a valid CSV.",
        variant: "destructive"
      });
    }
  };

  const handleUpload = () => {
    if (!validationResult || !validationResult.valid) return;
    console.log("Starting upload with validated rows:", validationResult.validatedRows);
    setIsUploading(true);
    uploadMutation.mutate(validationResult.validatedRows);
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch("/api/key-bunches/csv/template", {
        credentials: "include"
      });
      
      if (!response.ok) throw new Error("Failed to download template");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'key-bunches-template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Template downloaded",
        description: "CSV template has been downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download CSV template",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bulk Upload Key Bunches</h1>
        <p className="text-gray-600">Upload multiple key bunches at once using a CSV file</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Download Template</CardTitle>
          <CardDescription>
            Download the CSV template with the correct format and example data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline" data-testid="button-download-template">
            <Download className="mr-2 h-4 w-4" />
            Download CSV Template
          </Button>
          <div className="mt-4 text-sm text-gray-600">
            <p className="font-medium mb-2">The template includes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>identifier - Unique identifier for the key bunch (e.g., A24-001)</li>
              <li>type - Type of keys (day_shift, night_shift, lock_ups, static)</li>
              <li>currentTag - Current physical tag ID (must be unique)</li>
              <li>nfcSerial - Optional NFC serial number</li>
              <li>locationName - Name of the location (must match existing location)</li>
              <li>status - Status of the key bunch (active, issued, missing)</li>
              <li>keyCount - Number of keys in the bunch</li>
              <li>fobCount - Number of fobs in the bunch</li>
              <li>keyDescription - Description of what the keys unlock</li>
              <li>address - Physical address identifier (e.g., 23 bolerno place, BME 24)</li>
              <li>notes - Additional notes</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Upload CSV File</CardTitle>
          <CardDescription>
            Select your filled CSV file to validate and upload
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
              data-testid="input-csv-file"
            />
          </div>

          {csvFile && (
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">{csvFile.name}</span> ({(csvFile.size / 1024).toFixed(2)} KB)
              </AlertDescription>
            </Alert>
          )}

          {csvFile && !validationResult && (
            <Button 
              onClick={handleValidate} 
              disabled={validateMutation.isPending}
              data-testid="button-validate"
            >
              {validateMutation.isPending ? "Validating..." : "Validate CSV"}
            </Button>
          )}
        </CardContent>
      </Card>

      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Review & Confirm</CardTitle>
            <CardDescription>
              Review the validation results before uploading
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-2xl font-bold">{validationResult.summary.total}</div>
                <div className="text-sm text-gray-600">Total Rows</div>
              </div>
              <div className="border rounded-lg p-4 border-green-200 bg-green-50">
                <div className="text-2xl font-bold text-green-700">{validationResult.summary.valid}</div>
                <div className="text-sm text-green-600">Valid Rows</div>
              </div>
              <div className="border rounded-lg p-4 border-red-200 bg-red-50">
                <div className="text-2xl font-bold text-red-700">{validationResult.summary.invalid}</div>
                <div className="text-sm text-red-600">Invalid Rows</div>
              </div>
            </div>

            {validationResult.errors.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-red-700 flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Validation Errors
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {validationResult.errors.map((error) => (
                    <Alert key={error.row} variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-medium">Row {error.row}: {error.data.identifier || 'Unknown'}</div>
                        <ul className="list-disc list-inside mt-1 text-sm">
                          {error.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {validationResult.valid && (
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    All rows passed validation! Ready to upload {validationResult.validatedRows.length} key bunches.
                  </AlertDescription>
                </Alert>

                <div>
                  <h3 className="font-semibold mb-2">Preview of Valid Rows:</h3>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Identifier</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Seal</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Location</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Keys</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {validationResult.validatedRows.slice(0, 10).map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm">{row.identifier}</td>
                            <td className="px-4 py-2 text-sm">
                              <Badge variant="outline">{getTypeDisplayName(row.type)}</Badge>
                            </td>
                            <td className="px-4 py-2 text-sm font-mono text-xs">{row.currentTag || '-'}</td>
                            <td className="px-4 py-2 text-sm">{row.locationName || '-'}</td>
                            <td className="px-4 py-2 text-sm">
                              <Badge>{getStatusDisplayName(row.status)}</Badge>
                            </td>
                            <td className="px-4 py-2 text-sm">{row.keyCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {validationResult.validatedRows.length > 10 && (
                      <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50 text-center">
                        ... and {validationResult.validatedRows.length - 10} more rows
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleUpload} 
                    disabled={isUploading || uploadMutation.isPending}
                    data-testid="button-upload"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isUploading ? "Uploading..." : "Upload Key Bunches"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setCsvFile(null);
                      setValidationResult(null);
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkUpload;
