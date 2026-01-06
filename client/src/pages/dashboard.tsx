import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, Shield, BarChart3, Target, ChevronRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard } from "@/components/metric-card";
import { RiskBadge } from "@/components/risk-badge";
import { WalletAddress } from "@/components/wallet-address";
import type { DashboardStats, Wallet } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  const { data: flaggedWallets, isLoading: walletsLoading } = useQuery<Wallet[]>({
    queryKey: ["/api/wallets/flagged"],
  });

  if (statsLoading || walletsLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time insider trading detection for Polymarket
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Flagged Today"
          value={stats?.totalFlaggedToday ?? 0}
          trend={{ value: 12, label: "vs yesterday" }}
          icon={<AlertTriangle className="h-5 w-5 text-muted-foreground" />}
          testId="metric-total-flagged"
        />
        <MetricCard
          title="High-Risk Count"
          value={stats?.highRiskCount ?? 0}
          trend={{ value: 8, label: "vs yesterday" }}
          icon={<Shield className="h-5 w-5 text-muted-foreground" />}
          testId="metric-high-risk"
        />
        <MetricCard
          title="Markets Monitored"
          value={stats?.activeMarketsMonitored ?? 0}
          trend={{ value: 0, label: "active" }}
          icon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}
          testId="metric-markets"
        />
        <MetricCard
          title="Detection Accuracy"
          value={`${stats?.detectionAccuracy ?? 0}%`}
          trend={{ value: -2, label: "improving" }}
          icon={<Target className="h-5 w-5 text-muted-foreground" />}
          testId="metric-accuracy"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg font-semibold">
              Recently Flagged Wallets
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Wallets with suspicious betting patterns detected in the last 24 hours
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/wallets" data-testid="link-view-all-wallets">
              View All
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {flaggedWallets && flaggedWallets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Risk Score
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Wallet Address
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Win Rate
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Total Volume
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Account Age
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flaggedWallets.slice(0, 10).map((wallet) => (
                  <TableRow
                    key={wallet.id}
                    className="h-12 hover-elevate active-elevate-2 cursor-pointer"
                    data-testid={`row-wallet-${wallet.id}`}
                  >
                    <TableCell>
                      <RiskBadge score={wallet.riskScore} size="sm" />
                    </TableCell>
                    <TableCell>
                      <WalletAddress address={wallet.address} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm" data-testid={`text-winrate-${wallet.id}`}>
                        {(wallet.winRate * 100).toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm" data-testid={`text-volume-${wallet.id}`}>
                        ${wallet.totalVolume.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span data-testid={`text-age-${wallet.id}`}>
                          {wallet.accountAgeDays}d
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/wallets/${wallet.id}`}
                          data-testid={`link-wallet-detail-${wallet.id}`}
                        >
                          View Details
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No flagged wallets</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                No suspicious wallet activity has been detected. The system is continuously monitoring for insider trading patterns.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
