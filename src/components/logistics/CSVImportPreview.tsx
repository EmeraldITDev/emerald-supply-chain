import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface CSVColumn {
  key: string;
  label: string;
  required?: boolean;
}

export interface CSVImportPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  columns: CSVColumn[];
  onConfirmImport: (data: Record<string, string>[]) => Promise<void>;
  templateHeaders?: string[];
  onDownloadTemplate?: () => void;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

export const CSVImportPreview = ({
  open,
  onOpenChange,
  title,
  description,
  columns,
  onConfirmImport,
  onDownloadTemplate,
}: CSVImportPreviewProps) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const reset = () => {
    setFile(null);
    setParsedData([]);
    setParseErrors([]);
    setStep("upload");
    setIsImporting(false);
  };

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) {
          setParseErrors(["File is empty"]);
          return;
        }

        const { headers, rows } = parseCSV(text);
        const errors: string[] = [];

        // Map headers to column keys (case-insensitive match)
        const headerMap: Record<number, string> = {};
        headers.forEach((h, i) => {
          const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, "_");
          const col = columns.find(
            (c) =>
              c.key.toLowerCase() === normalized ||
              c.label.toLowerCase().replace(/[^a-z0-9]/g, "_") === normalized ||
              c.key.toLowerCase() === h.toLowerCase() ||
              c.label.toLowerCase() === h.toLowerCase()
          );
          if (col) {
            headerMap[i] = col.key;
          }
        });

        // Check required columns
        const mappedKeys = Object.values(headerMap);
        columns
          .filter((c) => c.required)
          .forEach((c) => {
            if (!mappedKeys.includes(c.key)) {
              errors.push(`Missing required column: ${c.label}`);
            }
          });

        if (rows.length === 0) {
          errors.push("No data rows found in file");
        }

        // Parse rows into objects
        const data: Record<string, string>[] = rows.map((row, rowIdx) => {
          const obj: Record<string, string> = {};
          Object.entries(headerMap).forEach(([colIdx, key]) => {
            obj[key] = row[Number(colIdx)] || "";
          });
          // Also store unmapped columns with original header names
          headers.forEach((h, i) => {
            if (!headerMap[i]) {
              obj[h] = row[i] || "";
            }
          });
          return obj;
        });

        // Validate required fields per row
        data.forEach((row, i) => {
          columns
            .filter((c) => c.required)
            .forEach((c) => {
              if (!row[c.key] || row[c.key].trim() === "") {
                errors.push(`Row ${i + 1}: Missing required field "${c.label}"`);
              }
            });
        });

        setParseErrors(errors.filter((_, i) => i < 10)); // Show max 10 errors
        setParsedData(data);
        setStep("preview");
      };
      reader.readAsText(selectedFile);
    },
    [columns]
  );

  const handleConfirm = async () => {
    setIsImporting(true);
    try {
      await onConfirmImport(parsedData);
      toast({
        title: "Import Successful",
        description: `${parsedData.length} record(s) imported successfully`,
      });
      reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const hasBlockingErrors = parseErrors.some((e) =>
    e.startsWith("Missing required column")
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) reset();
        onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            {onDownloadTemplate && (
              <Button variant="outline" className="w-full" onClick={onDownloadTemplate}>
                <FileText className="mr-2 h-4 w-4" />
                Download CSV Template
              </Button>
            )}
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                id="csv-import-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
              <label htmlFor="csv-import-file" className="cursor-pointer block">
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to select a CSV file
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Expected columns: {columns.map((c) => c.label).join(", ")}
                </p>
              </label>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">{file?.name}</span>
                <Badge variant="outline">{parsedData.length} rows</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
                <X className="h-4 w-4 mr-1" /> Change File
              </Button>
            </div>

            {/* Errors */}
            {parseErrors.length > 0 && (
              <Alert variant={hasBlockingErrors ? "destructive" : "default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">
                    {hasBlockingErrors ? "Cannot import — fix these issues:" : "Warnings:"}
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {parseErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Data preview */}
            {parsedData.length > 0 && (
              <div className="border rounded-lg overflow-x-auto max-h-[350px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      {columns.map((col) => (
                        <TableHead key={col.key}>
                          {col.label}
                          {col.required && <span className="text-destructive ml-0.5">*</span>}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        {columns.map((col) => (
                          <TableCell
                            key={col.key}
                            className={cn(
                              "text-sm",
                              col.required && !row[col.key]?.trim() && "bg-destructive/10"
                            )}
                          >
                            {row[col.key] || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedData.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Showing first 50 of {parsedData.length} rows
                  </p>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-success">
                <CheckCircle2 className="h-4 w-4" />
                {parsedData.length} row(s) ready
              </div>
              {parseErrors.filter((e) => e.startsWith("Row ")).length > 0 && (
                <div className="flex items-center gap-1 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  {parseErrors.filter((e) => e.startsWith("Row ")).length} row warning(s)
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancel
          </Button>
          {step === "preview" && (
            <Button
              onClick={handleConfirm}
              disabled={isImporting || hasBlockingErrors || parsedData.length === 0}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm Import ({parsedData.length} rows)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CSVImportPreview;
