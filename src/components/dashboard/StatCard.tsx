import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: string;
  onClick?: () => void;
}

export const StatCard = ({
  title,
  value,
  description,
  icon: Icon,
  iconColor = "text-primary",
  trend,
  onClick,
}: StatCardProps) => {
  return (
    <Card 
      className={cn(
        "transition-smooth hover:shadow-md",
        onClick && "cursor-pointer hover:scale-[1.02]"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn("h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center", iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p className="text-xs text-muted-foreground mt-2 font-medium">{trend}</p>
        )}
      </CardContent>
    </Card>
  );
};
