import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    label: string;
  };
  icon?: React.ReactNode;
  className?: string;
  testId?: string;
}

export function MetricCard({ title, value, trend, icon, className, testId }: MetricCardProps) {
  const getTrendIcon = (trendValue: number) => {
    if (trendValue > 0) return <TrendingUp className="h-3 w-3" />;
    if (trendValue < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = (trendValue: number) => {
    if (trendValue > 0) return "text-red-500";
    if (trendValue < 0) return "text-green-500";
    return "text-muted-foreground";
  };

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p
              className="text-3xl font-bold tracking-tight"
              data-testid={testId || `metric-${title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {value}
            </p>
            {trend && (
              <div className={cn("flex items-center gap-1 text-xs", getTrendColor(trend.value))}>
                {getTrendIcon(trend.value)}
                <span className="font-medium">
                  {trend.value > 0 ? "+" : ""}
                  {trend.value}%
                </span>
                <span className="text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
