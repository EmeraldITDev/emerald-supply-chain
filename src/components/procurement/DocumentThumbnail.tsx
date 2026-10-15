import { useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentThumbnailProps {
  fileName: string;
  fileUrl?: string;
  className?: string;
}

type PreviewKind = "image" | "pdf" | "none";

function getExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? (parts.pop() ?? "").toLowerCase() : "";
}

function getPreviewKind(fileName: string): PreviewKind {
  const ext = getExtension(fileName);
  if (["png", "jpg", "jpeg"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "none";
}

/**
 * Small inline preview of a procurement document. Images render via `<img>`
 * and PDFs via `<iframe>` straight from the pre-signed URL; DOCX/DOC and
 * anything else fall back to a "download to view" placeholder.
 */
export default function DocumentThumbnail({
  fileName,
  fileUrl,
  className,
}: DocumentThumbnailProps) {
  const [failed, setFailed] = useState(false);
  // The registry re-signs URLs on every fetch (e.g. each Download click); keep
  // the first one so the preview doesn't reload. Signed URLs last 7 days.
  const [src, setSrc] = useState(fileUrl);
  if (!src && fileUrl) setSrc(fileUrl);
  const kind = src && !failed ? getPreviewKind(fileName) : "none";

  if (kind === "image") {
    return (
      <img
        src={src}
        alt={fileName}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("h-40 w-full bg-muted/30 object-contain", className)}
      />
    );
  }

  if (kind === "pdf") {
    return (
      <iframe
        // The fragment is never sent to S3, so the pre-signed signature stays valid.
        src={`${src}#toolbar=0&navpanes=0&view=FitH`}
        title={fileName}
        loading="lazy"
        className={cn("h-40 w-full bg-muted/30", className)}
      />
    );
  }

  const ext = getExtension(fileName).toUpperCase();
  return (
    <div
      className={cn(
        "flex h-40 w-full flex-col items-center justify-center gap-1 bg-muted/30 text-muted-foreground",
        className,
      )}
    >
      <FileText className="h-8 w-8" />
      {ext && <span className="text-xs font-semibold">{ext}</span>}
      <span className="text-xs">Preview not available — download to view</span>
    </div>
  );
}
