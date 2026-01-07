import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Clock,
  Users,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/risk-badge";
import type { EarningsInsiderAlert, EarningsStats } from "@shared/schema";

function EarningsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="space-y-1 p-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type SortField = "risk" | "date" | "divergence" | "whales";

export default function Earnings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [daysFilter, setDaysFilter] = useState<string>("30");
  const [minDivergence, setMinDivergence] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>("risk");

  const { data: alerts, isLoading: alertsLoading } = useQuery<
    EarningsInsiderAlert[]
  >({
    queryKey: ["/api/earnings"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<EarningsStats>({
    queryKey: ["/api/earnings/stats"],
  });

  if (alertsLoading || statsLoading) {
    return <EarningsSkeleton />;
  }

  const filteredAlerts = alerts
    ?.filter((alert) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !alert.symbol.toLowerCase().includes(query) &&
          !alert.companyName.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      // Days filter
      if (daysFilter !== "all" && alert.daysUntilEarnings > parseInt(daysFilter)) {
        return false;
      }
      // Divergence filter
      if (alert.divergence < minDivergence / 100) {
        return false;
      }
      // Score filter
      if (alert.insiderRiskScore < minScore) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "risk":
          return b.insiderRiskScore - a.insiderRiskScore;
        case "date":
          return a.daysUntilEarnings - b.daysUntilEarnings;
        case "divergence":
          return b.divergence - a.divergence;
        case "whales":
          return b.suspiciousWhaleCount - a.suspiciousWhaleCount;
        default:
          return 0;
      }
    });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDaysUntil = (days: number) => {
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `${days} days`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          data-testid="text-page-title"
        >
          Earnings Insider Detector
        </h1>
        <p className="text-sm text-muted-foreground">
          Detect potential insider trading around corporate earnings announcements
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">
                Earnings Tracked
              </span>
            </div>
            <p className="text-2xl font-bold font-mono">
              {stats?.totalEarningsTracked ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">
                Matched Markets
              </span>
            </div>
            <p className="text-2xl font-bold font-mono">
              {stats?.matchedMarketsCount ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">
                High Risk Alerts
              </span>
            </div>
            <p className="text-2xl font-bold font-mono text-orange-500">
              {stats?.highRiskAlertsCount ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">
                Avg Divergence
              </span>
            </div>
            <p className="text-2xl font-bold font-mono">
              {((stats?.avgDivergence ?? 0) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <Label className="text-xs mb-2 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by ticker or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-earnings"
                />
              </div>
            </div>

            <div className="w-40">
              <Label className="text-xs mb-2 block">Earnings Within</Label>
              <Select value={daysFilter} onValueChange={setDaysFilter}>
                <SelectTrigger data-testid="select-days-filter">
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <Label className="text-xs mb-2 block">
                Min Divergence: {minDivergence}%
              </Label>
              <Slider
                value={[minDivergence]}
                onValueChange={(v) => setMinDivergence(v[0])}
                min={0}
                max={50}
                step={5}
                data-testid="slider-divergence"
              />
            </div>

            <div className="w-48">
              <Label className="text-xs mb-2 block">
                Min Risk Score: {minScore}
              </Label>
              <Slider
                value={[minScore]}
                onValueChange={(v) => setMinScore(v[0])}
                min={0}
                max={100}
                step={10}
                data-testid="slider-score"
              />
            </div>

            <div className="w-40">
              <Label className="text-xs mb-2 block">Sort By</Label>
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as SortField)}
              >
                <SelectTrigger data-testid="select-sort">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="risk">Risk Score</SelectItem>
                  <SelectItem value="date">Earnings Date</SelectItem>
                  <SelectItem value="divergence">Divergence</SelectItem>
                  <SelectItem value="whales">Whale Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredAlerts && filteredAlerts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Company / Ticker
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Earnings Date
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Insider Risk
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    PM Odds
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Analyst Consensus
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Divergence
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Sus. Whales
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((alert) => (
                  <TableRow
                    key={alert.id}
                    className="h-12 hover-elevate cursor-pointer"
                    data-testid={`row-earnings-${alert.id}`}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{alert.symbol}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {alert.companyName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-sm">
                          {formatDate(alert.earningsDate)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDaysUntil(alert.daysUntilEarnings)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RiskBadge score={alert.insiderRiskScore} size="sm" />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {(alert.polymarketOdds * 100).toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {alert.analystConsensus !== null ? (
                        <span className="font-mono text-sm">
                          {(alert.analystConsensus * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={alert.divergence >= 0.2 ? "destructive" : "secondary"}
                        className="font-mono"
                      >
                        {(alert.divergence * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-sm">
                          {alert.suspiciousWhaleCount}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No earnings alerts found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                {searchQuery
                  ? "No earnings match your search criteria. Try adjusting filters."
                  : "No upcoming earnings with matched Polymarket markets detected."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {filteredAlerts && filteredAlerts.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <p data-testid="text-earnings-count">
            Showing {filteredAlerts.length} of {alerts?.length ?? 0} earnings
            alerts
          </p>
        </div>
      )}
    </div>
  );
}
