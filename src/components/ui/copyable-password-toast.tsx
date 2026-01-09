import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface CopyablePasswordProps {
  password: string;
  label?: string;
}

export const CopyablePassword = ({ password, label = "Temporary password" }: CopyablePasswordProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2 p-2 bg-muted rounded-md">
      <div className="flex-1">
        <span className="text-xs text-muted-foreground block">{label}:</span>
        <code className="text-sm font-mono font-medium">{password}</code>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-8 w-8 p-0 shrink-0"
      >
        {copied ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
};
