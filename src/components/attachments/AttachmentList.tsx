import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeAttachments } from "@/utils/attachments";

type AttachmentListProps = {
  attachments: unknown;
  title?: string;
  empty?: string | null;
};

export function AttachmentList({
  attachments,
  title = "Attached Documents",
  empty = null,
}: AttachmentListProps) {
  const docs = normalizeAttachments(attachments);

  if (docs.length === 0) {
    return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {title} ({docs.length})
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {docs.map((doc, index) => (
          <a
            key={`${doc.url}-${index}`}
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
          >
            <span className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{doc.name}</span>
            </span>
            <Button type="button" variant="ghost" size="sm" className="shrink-0">
              <Download className="h-4 w-4" />
            </Button>
          </a>
        ))}
      </div>
    </div>
  );
}
