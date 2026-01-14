import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OneDriveLinkProps {
  webUrl?: string | null;
  fileName?: string;
  variant?: "button" | "badge" | "link";
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const OneDriveLink = ({ 
  webUrl, 
  fileName, 
  variant = "badge",
  className = "",
  size = "sm"
}: OneDriveLinkProps) => {
  if (!webUrl) return null;

  const handleClick = () => {
    if (webUrl) {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (variant === "badge") {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "cursor-pointer hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors",
          "flex items-center gap-1 w-fit",
          className
        )}
        onClick={handleClick}
      >
        <FileText className="h-3 w-3" />
        <span>On OneDrive</span>
        <ExternalLink className="h-3 w-3" />
      </Badge>
    );
  }

  if (variant === "link") {
    return (
      <a
        href={webUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors",
          className
        )}
        onClick={(e) => {
          e.preventDefault();
          handleClick();
        }}
      >
        <FileText className="h-4 w-4" />
        <span>View on OneDrive</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  // Button variant (default)
  const buttonSizeClass = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    lg: "h-10 px-5 text-base"
  }[size];

  return (
    <Button
      variant="outline"
      size={size === "sm" ? "sm" : size === "lg" ? "lg" : "default"}
      onClick={handleClick}
      className={cn("flex items-center gap-2", buttonSizeClass, className)}
    >
      <FileText className="h-4 w-4" />
      <span>{fileName ? `View ${fileName}` : 'View on OneDrive'}</span>
      <ExternalLink className="h-3 w-3" />
    </Button>
  );
};
