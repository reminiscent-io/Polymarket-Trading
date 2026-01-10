/**
 * Polymarket API Client
 * Connects to real Polymarket APIs to fetch markets, trades, and wallet data
 *
 * API Endpoints:
 * - Markets: https://gamma-api.polymarket.com/markets
 * - Trades: https://data-api.polymarket.com/trades
 * - CLOB (Authenticated): https://clob.polymarket.com
 */

import { createHmac } from "crypto";

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
  value: number;
  avgPrice?: number;
  currentPrice?: number;
  title?: string;
  outcome?: string;
  outcomeIndex?: number;
  unrealizedPnl?: number;
}

// Authenticated API types
export interface UserPortfolio {
  totalValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  positions: PortfolioPosition[];
  recentTrades: PolymarketTrade[];
  balance: number;
  cashBalance: number;
  totalEquity: number;
}

export interface PortfolioPosition extends PolymarketPosition {
  marketQuestion: string;
  marketSlug: string;
  unrealizedPnl: number;
  realizedPnl: number;
  roi: number;
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
  private portfolioCache: CacheEntry<UserPortfolio> | null = null;

  private readonly GAMMA_API = "https://gamma-api.polymarket.com";
  private readonly DATA_API = "https://data-api.polymarket.com";
  private readonly CLOB_API = "https://clob.polymarket.com";

  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;
  private readonly walletAddress: string | undefined;

  constructor() {
    this.apiKey = process.env.POLYMARKET_API_KEY;
    this.apiSecret = process.env.POLYMARKET_API_SECRET;
    this.walletAddress = process.env.POLYMARKET_WALLET_ADDRESS;

    if (this.apiKey && this.apiSecret) {
      console.log("[Polymarket] Authenticated API enabled");
    } else {
      console.log("[Polymarket] Running in public API mode only");
    }
  }

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
   * Get current positions for a wallet address
   */
  async getWalletPositions(walletAddress: string): Promise<PolymarketPosition[]> {
    const params = new URLSearchParams({
      user: walletAddress,
    });

    const url = `${this.DATA_API}/positions?${params}`;
    console.log(`[Polymarket] Fetching positions for ${walletAddress.slice(0, 10)}...`);

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

      const positions = await response.json() as PolymarketPosition[];
      console.log(`[Polymarket] Fetched ${positions.length} positions`);
      return positions;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch positions:", error);
      return []; // Return empty array on error instead of throwing
    }
  }

  /**
   * Calculate total position value for a wallet
   */
  async getWalletPositionValue(walletAddress: string): Promise<number> {
    try {
      const positions = await this.getWalletPositions(walletAddress);
      return positions.reduce((total, pos) => total + (pos.value || 0), 0);
    } catch (error) {
      console.error("[Polymarket] Failed to calculate position value:", error);
      return 0;
    }
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
   * Generate HMAC signature for authenticated requests
   */
  private generateSignature(timestamp: string, method: string, path: string, body: string = ""): string {
    if (!this.apiSecret) {
      throw new Error("API secret not configured");
    }
    const message = timestamp + method + path + body;
    return createHmac("sha256", this.apiSecret).update(message).digest("hex");
  }

  /**
   * Make authenticated request to CLOB API
   */
  private async authenticatedRequest<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error("Polymarket API credentials not configured. Set POLYMARKET_API_KEY and POLYMARKET_API_SECRET in Replit Secrets.");
    }

    const timestamp = Date.now().toString();
    const bodyString = body ? JSON.stringify(body) : "";
    const signature = this.generateSignature(timestamp, method, path, bodyString);

    const url = `${this.CLOB_API}${path}`;
    console.log(`[Polymarket] Authenticated ${method} request to: ${url}`);

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "POLY-API-KEY": this.apiKey,
        "POLY-SIGNATURE": signature,
        "POLY-TIMESTAMP": timestamp,
      },
      body: bodyString || undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CLOB API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Check if authenticated API is available
   */
  isAuthenticated(): boolean {
    return !!(this.apiKey && this.apiSecret && this.walletAddress);
  }

  /**
   * Get USDC balance from Polygon blockchain directly
   */
  async getUSDCBalanceFromChain(walletAddress: string): Promise<number> {
    try {
      // USDC contract on Polygon: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
      const USDC_CONTRACT = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
      const POLYGON_RPC = "https://polygon-rpc.com";

      // ERC20 balanceOf function signature
      const functionSignature = "0x70a08231"; // balanceOf(address)
      const paddedAddress = walletAddress.toLowerCase().replace("0x", "").padStart(64, "0");
      const data = functionSignature + paddedAddress;

      console.log(`[Polymarket] Querying USDC balance from Polygon for ${walletAddress.slice(0, 10)}...`);

      const response = await fetch(POLYGON_RPC, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [
            {
              to: USDC_CONTRACT,
              data: data,
            },
            "latest",
          ],
        }),
      });

      if (!response.ok) {
        console.warn(`[Polymarket] Polygon RPC returned ${response.status}`);
        return 0;
      }

      const result = await response.json();
      console.log(`[Polymarket] Polygon RPC response:`, JSON.stringify(result, null, 2));

      if (result.result) {
        // Convert hex to decimal
        const rawBalance = parseInt(result.result, 16);
        // USDC has 6 decimals
        const usdcBalance = rawBalance / 1e6;
        console.log(`[Polymarket] On-chain USDC balance: $${usdcBalance.toFixed(2)}`);
        return usdcBalance;
      }

      return 0;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch on-chain balance:", error);
      return 0;
    }
  }

  /**
   * Get wallet USDC balance from Polymarket API
   */
  async getWalletBalance(walletAddress: string): Promise<number> {
    try {
      // Try multiple endpoints to find balance
      console.log(`[Polymarket] Fetching balance for wallet: ${walletAddress}`);

      // Try endpoint 1: CLOB balance endpoint
      try {
        const url1 = `${this.CLOB_API}/balance?address=${walletAddress}`;
        console.log(`[Polymarket] Trying balance endpoint: ${url1}`);

        const response1 = await fetch(url1, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "InsiderTradingDetector/1.0",
          },
        });

        if (response1.ok) {
          const balanceData = await response1.json();
          console.log(`[Polymarket] Balance API response:`, JSON.stringify(balanceData, null, 2));

          // Try different possible response formats
          let rawBalance = 0;
          if (balanceData.balance) {
            rawBalance = parseFloat(balanceData.balance);
          } else if (balanceData.usdc) {
            rawBalance = parseFloat(balanceData.usdc);
          } else if (balanceData.USDC) {
            rawBalance = parseFloat(balanceData.USDC);
          } else if (typeof balanceData === "string") {
            rawBalance = parseFloat(balanceData);
          } else if (typeof balanceData === "number") {
            rawBalance = balanceData;
          }

          console.log(`[Polymarket] Raw balance value: ${rawBalance}`);

          // USDC has 6 decimals on Polygon
          const usdcBalance = rawBalance / 1e6;
          console.log(`[Polymarket] USDC balance after conversion: $${usdcBalance.toFixed(2)}`);

          if (!isNaN(usdcBalance) && usdcBalance > 0) {
            return usdcBalance;
          }
        }
      } catch (err) {
        console.warn(`[Polymarket] Balance endpoint 1 failed:`, err);
      }

      // Try endpoint 2: Data API positions endpoint might include balance
      try {
        const url2 = `${this.DATA_API}/balance?user=${walletAddress}`;
        console.log(`[Polymarket] Trying data API balance: ${url2}`);

        const response2 = await fetch(url2, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "InsiderTradingDetector/1.0",
          },
        });

        if (response2.ok) {
          const balanceData = await response2.json();
          console.log(`[Polymarket] Data API balance response:`, JSON.stringify(balanceData, null, 2));

          if (balanceData.balance) {
            const rawBalance = parseFloat(balanceData.balance);
            const usdcBalance = rawBalance / 1e6;
            console.log(`[Polymarket] Data API USDC balance: $${usdcBalance.toFixed(2)}`);

            if (!isNaN(usdcBalance) && usdcBalance > 0) {
              return usdcBalance;
            }
          }
        }
      } catch (err) {
        console.warn(`[Polymarket] Balance endpoint 2 failed:`, err);
      }

      // Try endpoint 3: Query Polygon blockchain directly
      console.log("[Polymarket] API endpoints failed, trying on-chain query...");
      const chainBalance = await this.getUSDCBalanceFromChain(walletAddress);
      if (!isNaN(chainBalance) && chainBalance >= 0) {
        return chainBalance;
      }

      console.warn("[Polymarket] Could not fetch balance from any source, returning 0");
      return 0;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch balance:", error);
      return 0;
    }
  }

  /**
   * Get user's portfolio (authenticated)
   */
  async getUserPortfolio(): Promise<UserPortfolio> {
    if (!this.isAuthenticated()) {
      throw new Error("Authentication required. Configure POLYMARKET_API_KEY, POLYMARKET_API_SECRET, and POLYMARKET_WALLET_ADDRESS.");
    }

    // Check cache
    if (this.isCacheValid(this.portfolioCache)) {
      console.log("[Polymarket] Returning cached portfolio");
      return this.portfolioCache!.data;
    }

    try {
      // Fetch user's positions
      const positions = await this.getWalletPositions(this.walletAddress!);

      // Fetch user's recent trades
      const trades = await this.getWalletTrades(this.walletAddress!, 100);

      // Fetch markets to enrich position data
      const markets = await this.getMarkets({ limit: 200 });
      const marketMap = new Map(markets.map(m => [m.conditionId, m]));

      // Calculate PnL and enrich positions
      let totalValue = 0;
      let unrealizedPnl = 0;
      let realizedPnl = 0;

      const enrichedPositions: PortfolioPosition[] = positions.map(pos => {
        const market = marketMap.get(pos.conditionId);
        const currentPrice = market?.lastTradePrice || pos.currentPrice || 0;
        const avgPrice = pos.avgPrice || 0;
        const positionValue = pos.size * currentPrice;
        const costBasis = pos.size * avgPrice;
        const pnl = positionValue - costBasis;
        const roi = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

        totalValue += positionValue;
        unrealizedPnl += pnl;

        return {
          ...pos,
          marketQuestion: market?.question || pos.title || "Unknown Market",
          marketSlug: market?.slug || "",
          currentPrice,
          avgPrice,
          unrealizedPnl: pnl,
          realizedPnl: 0, // Would need historical data to calculate
          roi,
        };
      });

      // Calculate realized PnL from closed trades (simplified)
      const tradesByMarket = new Map<string, PolymarketTrade[]>();
      for (const trade of trades) {
        const existing = tradesByMarket.get(trade.conditionId) || [];
        existing.push(trade);
        tradesByMarket.set(trade.conditionId, existing);
      }

      // Estimate realized PnL from completed positions
      for (const [conditionId, marketTrades] of Array.from(tradesByMarket.entries())) {
        const hasPosition = positions.some((p: PolymarketPosition) => p.conditionId === conditionId);
        if (!hasPosition && marketTrades.length > 1) {
          // Position closed - estimate PnL
          const buys = marketTrades.filter((t: PolymarketTrade) => t.side === "BUY");
          const sells = marketTrades.filter((t: PolymarketTrade) => t.side === "SELL");

          const totalBuyValue = buys.reduce((sum: number, t: PolymarketTrade) => sum + (t.size * t.price), 0);
          const totalSellValue = sells.reduce((sum: number, t: PolymarketTrade) => sum + (t.size * t.price), 0);

          realizedPnl += totalSellValue - totalBuyValue;
        }
      }

      // Fetch actual USDC cash balance
      // Try to use proxy wallet from positions if available, otherwise use configured wallet
      let walletToQuery = this.walletAddress!;
      if (positions.length > 0 && positions[0].proxyWallet) {
        walletToQuery = positions[0].proxyWallet;
        console.log(`[Polymarket] Using proxy wallet from positions: ${walletToQuery}`);
      }

      const cashBalance = await this.getWalletBalance(walletToQuery);
      const totalEquity = totalValue + cashBalance;

      const portfolio: UserPortfolio = {
        totalValue,
        unrealizedPnl,
        realizedPnl,
        positions: enrichedPositions,
        recentTrades: trades.slice(0, 20),
        balance: totalValue,
        cashBalance,
        totalEquity,
      };

      // Cache portfolio
      this.portfolioCache = {
        data: portfolio,
        timestamp: Date.now(),
      };

      console.log(`[Polymarket] Portfolio: ${positions.length} positions, $${totalValue.toFixed(2)} position value, $${cashBalance.toFixed(2)} cash, $${totalEquity.toFixed(2)} total equity`);
      return portfolio;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch portfolio:", error);
      // Return cached data if available
      if (this.portfolioCache) {
        console.log("[Polymarket] Returning stale cached portfolio");
        return this.portfolioCache.data;
      }
      throw error;
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.marketsCache = null;
    this.tradesCache.clear();
    this.allTradesCache = null;
    this.portfolioCache = null;
    console.log("[Polymarket] Cache cleared");
  }
}

// Singleton instance
export const polymarketClient = new PolymarketClient();
