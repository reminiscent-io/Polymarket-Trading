import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, BarChart3, Clock, AlertTriangle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RiskBadge } from "@/components/risk-badge";
import type { Market, PaginatedResult } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";

function MarketsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-full mb-4" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const categoryColors: Record<string, string> = {
  Politics: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Sports: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Crypto: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  Finance: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  Entertainment: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  Technology: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  Other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function Markets() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: result, isLoading } = useQuery<PaginatedResult<Market>>({
    queryKey: ["/api/markets"],
  });

  if (isLoading) {
    return <MarketsSkeleton />;
  }

  const markets = result?.data;

  const filteredMarkets = markets
    ?.filter((market) => {
      if (searchQuery && !market.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (categoryFilter !== "all" && market.category !== categoryFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.suspiciousWalletCount - a.suspiciousWalletCount);

  const categories = Array.from(new Set(markets?.map((m) => m.category) ?? []));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Markets
        </h1>
        <p className="text-sm text-muted-foreground">
          Markets with suspicious whale activity and insider betting patterns
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-markets"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40" data-testid="select-category-filter">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredMarkets && filteredMarkets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMarkets.map((market) => (
            <Card
              key={market.id}
              className="hover-elevate active-elevate-2 cursor-pointer transition-colors"
              data-testid={`card-market-${market.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <Badge
                    variant="outline"
                    className={categoryColors[market.category] ?? categoryColors.Other}
                  >
                    {market.category}
                  </Badge>
                  {market.suspiciousWalletCount > 0 && (
                    <RiskBadge score={Math.round(market.avgRiskScore)} size="sm" />
                  )}
                </div>

                <h3 className="font-semibold line-clamp-2 mb-4" data-testid={`text-market-name-${market.id}`}>
                  {market.name}
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>Suspicious Wallets</span>
                    </div>
                    <span className="font-mono font-medium" data-testid={`text-suspicious-count-${market.id}`}>
                      {market.suspiciousWalletCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <BarChart3 className="h-4 w-4" />
                      <span>Total Volume</span>
                    </div>
                    <span className="font-mono font-medium">
                      ${market.totalVolume.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Resolution</span>
                    </div>
                    <span className="font-mono text-sm">
                      {market.resolutionTime
                        ? market.isResolved
                          ? format(new Date(market.resolutionTime), "MMM d, yyyy")
                          : formatDistanceToNow(new Date(market.resolutionTime), { addSuffix: true })
                        : "TBD"}
                    </span>
                  </div>
                </div>

                {market.suspiciousWalletCount >= 3 && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>High suspicious activity</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No markets found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              {searchQuery
                ? "No markets match your search criteria. Try adjusting your filters."
                : "No markets are currently being monitored."}
            </p>
          </CardContent>
        </Card>
      )}

      {filteredMarkets && filteredMarkets.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <p data-testid="text-market-count">
            Showing {filteredMarkets.length} of {result?.total ?? 0} markets
          </p>
        </div>
      )}
    </div>
  );
}
