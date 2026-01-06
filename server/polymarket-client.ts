/**
 * Polymarket API Client
 * Connects to real Polymarket APIs to fetch markets, trades, and wallet data
 *
 * API Endpoints:
 * - Markets: https://gamma-api.polymarket.com/markets
 * - Trades: https://data-api.polymarket.com/trades
 */

// Polymarket API response types
export interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  conditionId: string;
  endDate: string | null;
  startDate: string | null;
  volume: string;
  volumeNum: number;
  liquidity: string;
  liquidityNum: number;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  enableOrderBook: boolean;
  bestBid: number;
  bestAsk: number;
  lastTradePrice: number;
  volume24hr: number;
  createdAt: string;
  updatedAt: string;
  clobTokenIds?: string[];
  outcomes?: string[];
  outcomePrices?: string[];
  tags?: { id: number; label: string; slug: string }[];
}

export interface PolymarketTrade {
  proxyWallet: string;
  side: "BUY" | "SELL";
  asset: string;
  conditionId: string;
  size: number;
  price: number;
  timestamp: number;
  title: string;
  slug: string;
  icon: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  name: string | null;
  pseudonym: string | null;
  bio: string | null;
  profileImage: string | null;
  transactionHash: string;
}

export interface PolymarketPosition {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  currentPrice: number;
  title: string;
  outcome: string;
  outcomeIndex: number;
  unrealizedPnl: number;
}

// Cache configuration
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

class PolymarketClient {
  private marketsCache: CacheEntry<PolymarketMarket[]> | null = null;
  private tradesCache: Map<string, CacheEntry<PolymarketTrade[]>> = new Map();
  private allTradesCache: CacheEntry<PolymarketTrade[]> | null = null;

  private readonly GAMMA_API = "https://gamma-api.polymarket.com";
  private readonly DATA_API = "https://data-api.polymarket.com";

  private isCacheValid<T>(cache: CacheEntry<T> | null | undefined): boolean {
    if (!cache) return false;
    return Date.now() - cache.timestamp < CACHE_TTL;
  }

  /**
   * Fetch markets from Polymarket Gamma API
   */
  async getMarkets(options: {
    limit?: number;
    offset?: number;
    active?: boolean;
    closed?: boolean;
  } = {}): Promise<PolymarketMarket[]> {
    // Check cache first
    if (this.isCacheValid(this.marketsCache)) {
      console.log("[Polymarket] Returning cached markets");
      return this.marketsCache!.data;
    }

    const { limit = 100, offset = 0, active = true, closed = false } = options;

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      active: active.toString(),
      closed: closed.toString(),
      order: "volume",
      ascending: "false",
    });

    const url = `${this.GAMMA_API}/markets?${params}`;
    console.log(`[Polymarket] Fetching markets from: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "InsiderTradingDetector/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`Gamma API error: ${response.status} ${response.statusText}`);
      }

      const markets = await response.json() as PolymarketMarket[];

      // Update cache
      this.marketsCache = {
        data: markets,
        timestamp: Date.now(),
      };

      console.log(`[Polymarket] Fetched ${markets.length} markets`);
      return markets;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch markets:", error);
      // Return cached data if available, even if stale
      if (this.marketsCache) {
        console.log("[Polymarket] Returning stale cached markets");
        return this.marketsCache.data;
      }
      throw error;
    }
  }

  /**
   * Fetch trades from Polymarket Data API
   */
  async getTrades(options: {
    user?: string;
    market?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PolymarketTrade[]> {
    const cacheKey = `${options.user || "all"}_${options.market || "all"}`;
    const cached = this.tradesCache.get(cacheKey);

    if (this.isCacheValid(cached)) {
      console.log(`[Polymarket] Returning cached trades for ${cacheKey}`);
      return cached!.data;
    }

    const { user, market, limit = 500, offset = 0 } = options;

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (user) {
      params.set("user", user);
    }
    if (market) {
      params.set("market", market);
    }

    const url = `${this.DATA_API}/trades?${params}`;
    console.log(`[Polymarket] Fetching trades from: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "InsiderTradingDetector/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`Data API error: ${response.status} ${response.statusText}`);
      }

      const trades = await response.json() as PolymarketTrade[];

      // Update cache
      this.tradesCache.set(cacheKey, {
        data: trades,
        timestamp: Date.now(),
      });

      console.log(`[Polymarket] Fetched ${trades.length} trades`);
      return trades;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch trades:", error);
      // Return cached data if available
      if (cached) {
        console.log("[Polymarket] Returning stale cached trades");
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * Fetch all recent trades to discover active wallets
   */
  async getRecentTrades(limit: number = 1000): Promise<PolymarketTrade[]> {
    if (this.isCacheValid(this.allTradesCache)) {
      console.log("[Polymarket] Returning cached recent trades");
      return this.allTradesCache!.data;
    }

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: "0",
    });

    const url = `${this.DATA_API}/trades?${params}`;
    console.log(`[Polymarket] Fetching recent trades from: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "InsiderTradingDetector/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`Data API error: ${response.status} ${response.statusText}`);
      }

      const trades = await response.json() as PolymarketTrade[];

      this.allTradesCache = {
        data: trades,
        timestamp: Date.now(),
      };

      console.log(`[Polymarket] Fetched ${trades.length} recent trades`);
      return trades;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch recent trades:", error);
      if (this.allTradesCache) {
        return this.allTradesCache.data;
      }
      throw error;
    }
  }

  /**
   * Get trades for a specific wallet address
   */
  async getWalletTrades(walletAddress: string, limit: number = 100): Promise<PolymarketTrade[]> {
    return this.getTrades({ user: walletAddress, limit });
  }

  /**
   * Get trades for a specific market
   */
  async getMarketTrades(conditionId: string, limit: number = 500): Promise<PolymarketTrade[]> {
    return this.getTrades({ market: conditionId, limit });
  }

  /**
   * Analyze wallet trading patterns to calculate risk metrics
   */
  analyzeWalletTrades(trades: PolymarketTrade[]): {
    winRate: number;
    totalBets: number;
    totalVolume: number;
    marketConcentration: number;
    avgTimingHours: number;
    uniqueMarkets: Set<string>;
  } {
    if (trades.length === 0) {
      return {
        winRate: 0,
        totalBets: 0,
        totalVolume: 0,
        marketConcentration: 0,
        avgTimingHours: 72,
        uniqueMarkets: new Set(),
      };
    }

    // Group trades by market
    const marketVolumes = new Map<string, number>();
    let totalVolume = 0;
    let wins = 0;
    let totalTrades = trades.length;

    for (const trade of trades) {
      const volume = trade.size * trade.price;
      totalVolume += volume;

      const currentMarketVol = marketVolumes.get(trade.conditionId) || 0;
      marketVolumes.set(trade.conditionId, currentMarketVol + volume);

      // Estimate win rate based on buy/sell pattern
      // This is a heuristic - in reality we'd need resolution data
      if (trade.side === "SELL" && trade.price > 0.5) {
        wins++;
      } else if (trade.side === "BUY" && trade.price < 0.5) {
        wins++;
      }
    }

    // Calculate concentration (max market volume / total volume)
    const maxMarketVolume = Math.max(...Array.from(marketVolumes.values()));
    const marketConcentration = totalVolume > 0 ? maxMarketVolume / totalVolume : 0;

    // Estimate average timing (would need market end dates for real calculation)
    // Using a placeholder based on trade recency
    const now = Date.now();
    const avgTradeAge = trades.reduce((sum, t) => sum + (now - t.timestamp * 1000), 0) / trades.length;
    const avgTimingHours = Math.min(168, avgTradeAge / (1000 * 60 * 60)); // Cap at 1 week

    return {
      winRate: totalTrades > 0 ? wins / totalTrades : 0,
      totalBets: totalTrades,
      totalVolume,
      marketConcentration,
      avgTimingHours,
      uniqueMarkets: new Set(marketVolumes.keys()),
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.marketsCache = null;
    this.tradesCache.clear();
    this.allTradesCache = null;
    console.log("[Polymarket] Cache cleared");
  }
}

// Singleton instance
export const polymarketClient = new PolymarketClient();
