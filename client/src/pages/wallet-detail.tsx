import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  AlertTriangle,
  Target,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RiskBadge, RiskScoreBar } from "@/components/risk-badge";
import { WalletAddress } from "@/components/wallet-address";
import type { WalletWithTransactions, RiskFactors } from "@shared/schema";
import { format } from "date-fns";

function WalletDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RiskFactorItem({
  label,
  value,
  maxValue,
  description,
}: {
  label: string;
  value: number;
  maxValue: number;
  description: string;
}) {
  const percentage = (value / maxValue) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-sm text-muted-foreground">
          {value.toFixed(1)}/{maxValue}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export default function WalletDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: walletData, isLoading } = useQuery<WalletWithTransactions>({
    queryKey: ["/api/wallets", id],
  });

  const { data: riskFactors } = useQuery<RiskFactors>({
    queryKey: ["/api/wallets", id, "risk-factors"],
  });

  if (isLoading) {
    return <WalletDetailSkeleton />;
  }

  if (!walletData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold">Wallet not found</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The wallet you're looking for doesn't exist or has been removed.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/wallets">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Wallets
          </Link>
        </Button>
      </div>
    );
  }

  const wallet = walletData;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/wallets" data-testid="button-back-wallets">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight font-mono" data-testid="text-wallet-address-full">
                {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
              </h1>
              <RiskBadge score={wallet.riskScore} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Account age: {wallet.accountAgeDays} days | Total volume: $
              {wallet.totalVolume.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <a
              href={`https://polygonscan.com/address/${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-polygonscan"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View on Polygonscan
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Win Rate</span>
                </div>
                <p className="text-2xl font-bold font-mono mt-1" data-testid="stat-winrate">
                  {(wallet.winRate * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Bets</span>
                </div>
                <p className="text-2xl font-bold font-mono mt-1" data-testid="stat-total-bets">
                  {wallet.totalBets}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Position</span>
                </div>
                <p className="text-2xl font-bold font-mono mt-1" data-testid="stat-position">
                  ${(wallet.currentPositionValue || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Concentration</span>
                </div>
                <p className="text-2xl font-bold font-mono mt-1" data-testid="stat-concentration">
                  {(wallet.portfolioConcentration * 100).toFixed(0)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Avg Timing</span>
                </div>
                <p className="text-2xl font-bold font-mono mt-1" data-testid="stat-timing">
                  {wallet.avgTimingProximity}h
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {wallet.transactions && wallet.transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium uppercase tracking-wide">
                        Date
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide">
                        Market
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide">
                        Direction
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide">
                        Amount
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide">
                        Hours Before Resolution
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide">
                        Result
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wallet.transactions.map((tx) => {
                      const market = wallet.markets?.find((m) => m.id === tx.marketId);
                      return (
                        <TableRow key={tx.id} className="h-12" data-testid={`row-tx-${tx.id}`}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(tx.timestamp), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm line-clamp-1" title={tx.marketTitle ?? market?.name}>
                              {tx.marketTitle ?? market?.name ?? "Unknown Market"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={tx.direction === "Yes" ? "default" : "secondary"}>
                              {tx.direction}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            ${tx.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {tx.hoursBeforeResolution ?? "-"}h
                            </span>
                          </TableCell>
                          <TableCell>
                            {tx.won === null ? (
                              <Badge variant="outline">Pending</Badge>
                            ) : tx.won ? (
                              <Badge className="bg-green-600 dark:bg-green-700">Won</Badge>
                            ) : (
                              <Badge variant="destructive">Lost</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No transactions</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    No transaction history available for this wallet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Risk Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Risk</span>
                  <span className="font-mono text-2xl font-bold">{wallet.riskScore}</span>
                </div>
                <RiskScoreBar score={wallet.riskScore} />
              </div>

              <div className="h-px bg-border my-4" />

              <div className="space-y-6">
                <RiskFactorItem
                  label="Account Age"
                  value={riskFactors?.accountAge ?? 0}
                  maxValue={25}
                  description="New accounts with large positions score higher"
                />
                <RiskFactorItem
                  label="Win Rate"
                  value={riskFactors?.winRate ?? 0}
                  maxValue={25}
                  description=">70% accuracy on early bets is suspicious"
                />
                <RiskFactorItem
                  label="Portfolio Concentration"
                  value={riskFactors?.portfolioConcentration ?? 0}
                  maxValue={25}
                  description="Single market >60% of capital"
                />
                <RiskFactorItem
                  label="Timing Proximity"
                  value={riskFactors?.timingProximity ?? 0}
                  maxValue={25}
                  description="Bets placed within 72h of resolution"
                />
              </div>
            </CardContent>
          </Card>

          {wallet.notes && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground" data-testid="text-wallet-notes">
                  {wallet.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
