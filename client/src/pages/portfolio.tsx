import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Activity,
  AlertCircle,
  Trophy,
  TrendingUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/metric-card";
import type { UserPortfolio, PortfolioStats } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

function PortfolioSkeleton() {
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

function formatCurrency(value: number): string {
  // Handle NaN and undefined values
  if (value === undefined || value === null || isNaN(value)) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function PnLBadge({ value }: { value: number }) {
  const isProfit = value >= 0;
  return (
    <Badge
      variant={isProfit ? "default" : "destructive"}
      className={isProfit ? "bg-green-500 hover:bg-green-600" : ""}
    >
      {isProfit ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
      {formatCurrency(Math.abs(value))}
    </Badge>
  );
}

export default function Portfolio() {
  const { data: availabilityData } = useQuery<{ available: boolean }>({
    queryKey: ["/api/portfolio/available"],
  });

  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
  } = useQuery<UserPortfolio>({
    queryKey: ["/api/portfolio"],
    enabled: availabilityData?.available === true,
    retry: false,
  });

  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery<PortfolioStats>({
    queryKey: ["/api/portfolio/stats"],
    enabled: availabilityData?.available === true,
    retry: false,
  });

  // Portfolio not configured
  if (availabilityData?.available === false) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-sm text-muted-foreground">
            Track your personal Polymarket positions and performance
          </p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Portfolio Tracking Not Configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              To enable portfolio tracking, configure your Polymarket API credentials in Replit
              Secrets:
            </p>
            <div className="text-left max-w-md mx-auto bg-muted p-4 rounded-md font-mono text-xs space-y-1">
              <div>POLYMARKET_API_KEY=your_api_key</div>
              <div>POLYMARKET_API_SECRET=your_secret</div>
              <div>POLYMARKET_WALLET_ADDRESS=0x...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (portfolioLoading || statsLoading) {
    return <PortfolioSkeleton />;
  }

  // Error state
  if (portfolioError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-sm text-muted-foreground">
            Track your personal Polymarket positions and performance
          </p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Portfolio</h3>
            <p className="text-sm text-muted-foreground">
              {portfolioError instanceof Error ? portfolioError.message : "Unknown error"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!portfolio || !stats) {
    return null;
  }

  const totalPnl = portfolio.unrealizedPnl + portfolio.realizedPnl;
  const totalPnlPercent =
    portfolio.totalValue > 0 ? (totalPnl / (portfolio.totalValue - totalPnl)) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          Track your personal Polymarket positions and performance
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Total Equity"
          value={formatCurrency(portfolio.totalEquity)}
          icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
        />
        <MetricCard
          title="Cash (USDC)"
          value={formatCurrency(portfolio.cashBalance)}
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
        />
        <MetricCard
          title="Total P&L"
          value={formatCurrency(totalPnl)}
          trend={
            totalPnl !== 0
              ? {
                  value: totalPnlPercent,
                  label: formatPercent(totalPnlPercent),
                }
              : undefined
          }
          icon={
            totalPnl >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )
          }
        />
        <MetricCard
          title="Active Positions"
          value={stats.totalPositions}
          icon={<Target className="h-5 w-5 text-muted-foreground" />}
        />
        <MetricCard
          title="Win Rate"
          value={`${(stats.winRate * 100).toFixed(1)}%`}
          icon={<Trophy className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      {/* Equity Breakdown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Positions Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatCurrency(portfolio.totalValue)}</span>
              <Badge variant="outline">
                {portfolio.totalEquity > 0
                  ? `${((portfolio.totalValue / portfolio.totalEquity) * 100).toFixed(1)}%`
                  : "0%"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Value of {stats.totalPositions} open position{stats.totalPositions !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cash Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatCurrency(portfolio.cashBalance)}</span>
              <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
                {portfolio.totalEquity > 0
                  ? `${((portfolio.cashBalance / portfolio.totalEquity) * 100).toFixed(1)}%`
                  : "0%"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Available USDC for trading</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Equity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatCurrency(portfolio.totalEquity)}</span>
              <Badge variant="default">100%</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Positions + Cash</p>
          </CardContent>
        </Card>
      </div>

      {/* P&L Breakdown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Unrealized P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatCurrency(portfolio.unrealizedPnl)}</span>
              <PnLBadge value={portfolio.unrealizedPnl} />
            </div>
            <p className="text-sm text-muted-foreground mt-2">From open positions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Realized P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatCurrency(portfolio.realizedPnl)}</span>
              <PnLBadge value={portfolio.realizedPnl} />
            </div>
            <p className="text-sm text-muted-foreground mt-2">From closed positions</p>
          </CardContent>
        </Card>
      </div>

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Open Positions ({portfolio.positions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {portfolio.positions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No open positions</p>
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Market</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                    <TableHead className="text-right">Current Price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolio.positions.map((position, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="max-w-xs">
                        <Link
                          href={`https://polymarket.com/event/${position.marketSlug}`}
                          className="text-sm hover:underline"
                        >
                          {position.marketQuestion}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{position.outcome}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {position.size.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${position.avgPrice.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${position.currentPrice.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(position.value)}
                      </TableCell>
                      <TableCell className="text-right">
                        <PnLBadge value={position.unrealizedPnl} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span
                          className={
                            position.roi >= 0 ? "text-green-600" : "text-destructive"
                          }
                        >
                          {formatPercent(position.roi)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Trades */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Recent Trades ({portfolio.recentTrades.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {portfolio.recentTrades.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent trades</p>
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolio.recentTrades.map((trade, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(trade.timestamp * 1000), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={trade.side === "BUY" ? "default" : "secondary"}>
                          {trade.side}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs text-sm">
                        {trade.marketQuestion}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{trade.outcome}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {trade.size.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${trade.price.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(trade.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Performers */}
      {stats.bestPosition && stats.worstPosition && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-green-500" />
                Best Performer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium mb-2">{stats.bestPosition.marketQuestion}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">P&L:</span>
                <PnLBadge value={stats.bestPosition.unrealizedPnl} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">ROI:</span>
                <span className="text-sm font-mono text-green-600">
                  {formatPercent(stats.bestPosition.roi)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                Worst Performer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium mb-2">{stats.worstPosition.marketQuestion}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">P&L:</span>
                <PnLBadge value={stats.worstPosition.unrealizedPnl} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">ROI:</span>
                <span className="text-sm font-mono text-destructive">
                  {formatPercent(stats.worstPosition.roi)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
