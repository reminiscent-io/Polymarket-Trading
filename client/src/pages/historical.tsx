import { useQuery } from "@tanstack/react-query";
import { Trophy, TrendingUp, Medal, Crown, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RiskBadge } from "@/components/risk-badge";
import { WalletAddress } from "@/components/wallet-address";
import type { Wallet, PaginatedResult } from "@shared/schema";

function HistoricalSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-full mb-4" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="space-y-1 p-4">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Historical() {
  const { data: result, isLoading } = useQuery<PaginatedResult<Wallet>>({
    queryKey: ["/api/wallets/historical"],
  });

  if (isLoading) {
    return <HistoricalSkeleton />;
  }

  const topWallets = result?.data;
  const topThree = topWallets?.slice(0, 3) ?? [];
  const restWallets = topWallets?.slice(3) ?? [];

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700";
      case 2:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300 border-gray-300 dark:border-gray-600";
      case 3:
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Historical Leaderboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Wallets with the highest insider probability scores that won their bets
        </p>
      </div>

      {topThree.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {topThree.map((wallet, index) => (
            <Card
              key={wallet.id}
              className={`relative overflow-visible ${index === 0 ? "md:order-2" : index === 1 ? "md:order-1" : "md:order-3"}`}
              data-testid={`card-top-wallet-${index + 1}`}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="outline" className={`${getRankBadgeColor(index + 1)} px-3 py-1`}>
                  {getRankIcon(index + 1)}
                  <span className="ml-1 font-semibold">#{index + 1}</span>
                </Badge>
              </div>
              <CardContent className="pt-8 pb-6 px-6">
                <div className="text-center space-y-4">
                  <div>
                    <WalletAddress address={wallet.address} className="justify-center" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold font-mono">{wallet.riskScore}</p>
                    <p className="text-xs text-muted-foreground mt-1">Risk Score</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-lg font-semibold font-mono">
                        {(wallet.winRate * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold font-mono">
                        ${(wallet.totalVolume / 1000).toFixed(0)}k
                      </p>
                      <p className="text-xs text-muted-foreground">Volume</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            Full Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {topWallets && topWallets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium uppercase tracking-wide w-16">
                    Rank
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Wallet Address
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Risk Score
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Win Rate
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Total Bets
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Total Volume
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Account Age
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topWallets.map((wallet, index) => (
                  <TableRow
                    key={wallet.id}
                    className="h-12"
                    data-testid={`row-historical-${wallet.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRankIcon(index + 1)}
                        <span className="font-mono font-medium">#{index + 1}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <WalletAddress address={wallet.address} showExternalLink />
                    </TableCell>
                    <TableCell>
                      <RiskBadge score={wallet.riskScore} size="sm" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="font-mono text-sm">
                          {(wallet.winRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{wallet.totalBets}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        ${wallet.totalVolume.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{wallet.accountAgeDays}d</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No historical data</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Historical leaderboard data will appear here once enough betting patterns have been analyzed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
