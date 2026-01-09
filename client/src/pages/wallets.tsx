import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Filter, Wallet as WalletIcon, Clock, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { RiskBadge } from "@/components/risk-badge";
import { WalletAddress } from "@/components/wallet-address";
import type { Wallet, PaginatedResult } from "@shared/schema";

function WalletsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-32" />
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

export default function Wallets() {
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [volumeFilter, setVolumeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("risk");

  const { data: result, isLoading } = useQuery<PaginatedResult<Wallet>>({
    queryKey: ["/api/wallets"],
  });

  if (isLoading) {
    return <WalletsSkeleton />;
  }

  const wallets = result?.data;

  const filteredWallets = wallets
    ?.filter((wallet) => {
      if (searchQuery && !wallet.address.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (riskFilter === "critical" && wallet.riskScore < 80) return false;
      if (riskFilter === "high" && (wallet.riskScore < 60 || wallet.riskScore >= 80)) return false;
      if (riskFilter === "medium" && (wallet.riskScore < 40 || wallet.riskScore >= 60)) return false;
      if (riskFilter === "low" && wallet.riskScore >= 40) return false;

      if (volumeFilter === "large" && wallet.totalVolume < 10000) return false;
      if (volumeFilter === "medium" && (wallet.totalVolume < 2500 || wallet.totalVolume >= 10000)) return false;
      if (volumeFilter === "small" && (wallet.totalVolume < 500 || wallet.totalVolume >= 2500)) return false;
      if (volumeFilter === "micro" && wallet.totalVolume >= 500) return false;

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "risk":
          return b.riskScore - a.riskScore;
        case "volume":
          return b.totalVolume - a.totalVolume;
        case "winrate":
          return b.winRate - a.winRate;
        case "age":
          return a.accountAgeDays - b.accountAgeDays;
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Flagged Wallets
        </h1>
        <p className="text-sm text-muted-foreground">
          All wallets with detected suspicious betting patterns
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by wallet address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-wallets"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-36" data-testid="select-risk-filter">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="critical">Critical (80+)</SelectItem>
              <SelectItem value="high">High (60-79)</SelectItem>
              <SelectItem value="medium">Medium (40-59)</SelectItem>
              <SelectItem value="low">Low (&lt;40)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={volumeFilter} onValueChange={setVolumeFilter}>
            <SelectTrigger className="w-36" data-testid="select-volume-filter">
              <WalletIcon className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Volume" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Volumes</SelectItem>
              <SelectItem value="large">Large (≥$10k)</SelectItem>
              <SelectItem value="medium">Medium ($2.5k-$10k)</SelectItem>
              <SelectItem value="small">Small ($500-$2.5k)</SelectItem>
              <SelectItem value="micro">Micro (&lt;$500)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-36" data-testid="select-sort">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="risk">Risk Score</SelectItem>
              <SelectItem value="volume">Volume</SelectItem>
              <SelectItem value="winrate">Win Rate</SelectItem>
              <SelectItem value="age">Account Age</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filteredWallets && filteredWallets.length > 0 ? (
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
                    Total Bets
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Total Volume
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Current Position
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Account Age
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Concentration
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWallets.map((wallet) => (
                  <TableRow
                    key={wallet.id}
                    className="h-12 hover-elevate active-elevate-2 cursor-pointer"
                    data-testid={`row-wallet-${wallet.id}`}
                  >
                    <TableCell>
                      <RiskBadge score={wallet.riskScore} size="sm" />
                    </TableCell>
                    <TableCell>
                      <WalletAddress address={wallet.address} showExternalLink />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {(wallet.winRate * 100).toFixed(1)}%
                      </span>
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
                      <span className="font-mono text-sm">
                        ${(wallet.currentPositionValue || 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{wallet.accountAgeDays}d</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {(wallet.portfolioConcentration * 100).toFixed(0)}%
                      </span>
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
              <WalletIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No wallets found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                {searchQuery
                  ? "No wallets match your search criteria. Try adjusting your filters."
                  : "No flagged wallets have been detected yet."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {filteredWallets && filteredWallets.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p data-testid="text-wallet-count">
            Showing {filteredWallets.length} of {result?.total ?? 0} wallets
          </p>
        </div>
      )}
    </div>
  );
}
