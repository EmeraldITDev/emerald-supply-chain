import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".xls", ".xlsx", ".csv", ".png", ".jpg", ".jpeg", ".webp"];
const ATTACHMENT_ACCEPT = ACCEPTED_EXTENSIONS.join(",");

type MultiFileDropzoneProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
};

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024).toFixed(1)} KB`;
}

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function validAttachment(file: File): boolean {
  const lower = file.name.toLowerCase();
  return file.size <= MAX_FILE_SIZE_BYTES && ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function MultiFileDropzone({
  files,
  onFilesChange,
  disabled = false,
  label = "Upload documents",
}: MultiFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [rejectedCount, setRejectedCount] = useState(0);

  const addFiles = (incoming: FileList | File[]) => {
    const next = Array.from(incoming);
    const valid = next.filter(validAttachment);
    setRejectedCount(next.length - valid.length);

    const existing = new Set(files.map(fileKey));
    const merged = [...files];
    valid.forEach((file) => {
      if (!existing.has(fileKey(file))) {
        merged.push(file);
      }
    });
    onFilesChange(merged);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (!disabled) addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "w-full rounded-lg border border-dashed p-5 text-left transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/20",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-background p-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">
              Drop files here or click to browse. PDF, Excel/CSV, and image files only, 10 MB each.
            </p>
          </div>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      {rejectedCount > 0 && (
        <p className="text-xs text-destructive">
          {rejectedCount} file(s) skipped. Use PDF, Excel/CSV, or image files up to 10 MB.
        </p>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={fileKey(file)} className="flex items-center justify-between gap-2 rounded-md border p-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onFilesChange(files.filter((f) => fileKey(f) !== fileKey(file)))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
