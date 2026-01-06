import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RiskBadgeProps {
  score: number;
  size?: "sm" | "default";
  className?: string;
}

export function RiskBadge({ score, size = "default", className }: RiskBadgeProps) {
  const getRiskLevel = (score: number) => {
    if (score >= 80) return { label: "Critical", variant: "destructive" as const };
    if (score >= 60) return { label: "High", variant: "default" as const };
    if (score >= 40) return { label: "Medium", variant: "secondary" as const };
    return { label: "Low", variant: "outline" as const };
  };

  const { label, variant } = getRiskLevel(score);

  return (
    <Badge
      variant={variant}
      className={cn(
        "font-mono",
        size === "sm" && "text-xs px-2 py-0.5",
        variant === "destructive" && "bg-red-600 dark:bg-red-700",
        variant === "default" && score >= 60 && score < 80 && "bg-orange-500 dark:bg-orange-600",
        className
      )}
      data-testid={`badge-risk-${score}`}
    >
      {score} - {label}
    </Badge>
  );
}

export function RiskScoreBar({ score }: { score: number }) {
  const getColor = (score: number) => {
    if (score >= 80) return "bg-red-500";
    if (score >= 60) return "bg-orange-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", getColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="font-mono text-sm w-8 text-right" data-testid={`text-risk-score-${score}`}>{score}</span>
    </div>
  );
}
