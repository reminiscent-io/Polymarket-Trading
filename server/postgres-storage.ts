/**
 * PostgreSQL Storage Implementation
 * Fetches data from Polymarket APIs and persists to PostgreSQL database
 */

import {
  type User,
  type InsertUser,
  type Wallet,
  type InsertWallet,
  type Market,
  type InsertMarket,
  type Transaction,
  type InsertTransaction,
  type DashboardStats,
  type WalletWithTransactions,
  type RiskFactors,
  type EarningsInsiderAlert,
  type EarningsStats,
  users,
  wallets,
  markets,
  transactions,
} from "@shared/schema";
import { randomUUID } from "crypto";
import {
  type IStorage,
  type PaginationOptions,
  type PaginatedResult,
  DEFAULT_PAGINATION,
} from "./storage-interface";
import { polymarketClient, type PolymarketMarket, type PolymarketTrade } from "./polymarket-client";
import { earningsClient } from "./earnings-client";
import {
  calculateRiskScore,
  calculateRiskFactors,
  shouldFlagWallet,
  RISK_THRESHOLDS,
} from "./risk-scoring";
import { db } from "./db";
import { eq, desc, and, sql, count } from "drizzle-orm";

/**
 * Map Polymarket categories from tags
 */
function categorizeMarket(market: PolymarketMarket): string {
  const question = market.question?.toLowerCase() || "";
  const tags = market.tags?.map(t => t.label.toLowerCase()) || [];

  if (tags.some(t => t.includes("crypto")) || question.includes("bitcoin") || question.includes("ethereum") || question.includes("crypto")) {
    return "Crypto";
  }
  if (tags.some(t => t.includes("politic")) || question.includes("election") || question.includes("president") || question.includes("congress")) {
    return "Politics";
  }
  if (tags.some(t => t.includes("sport")) || question.includes("super bowl") || question.includes("nba") || question.includes("nfl") || question.includes("championship")) {
    return "Sports";
  }
  if (tags.some(t => t.includes("tech")) || question.includes("ai") || question.includes("gpt") || question.includes("openai") || question.includes("apple")) {
    return "Technology";
  }
  if (question.includes("fed") || question.includes("rate") || question.includes("stock") || question.includes("market")) {
    return "Finance";
  }
  if (question.includes("oscar") || question.includes("movie") || question.includes("grammy") || question.includes("emmy")) {
    return "Entertainment";
  }
  return "Other";
}

export class PostgresStorage implements IStorage {
  private lastDataRefresh: number = 0;
  private isRefreshing: boolean = false;
  private readonly DATA_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    console.log("[PostgresStorage] Initialized with database connection");
    // Initial data load
    this.refreshData().catch(console.error);
  }

  /**
   * Refresh data from Polymarket APIs and store in database
   */
  async refreshData(): Promise<void> {
    if (this.isRefreshing) {
      console.log("[Storage] Already refreshing, skipping...");
      return;
    }

    const now = Date.now();
    if (now - this.lastDataRefresh < this.DATA_REFRESH_INTERVAL) {
      console.log("[Storage] Data is fresh, skipping refresh");
      return;
    }

    this.isRefreshing = true;
    console.log("[Storage] Refreshing data from Polymarket...");

    try {
      // Fetch markets
      const polymarkets = await polymarketClient.getMarkets({ limit: 50, active: true });

      // Fetch recent trades to discover active wallets
      const recentTrades = await polymarketClient.getRecentTrades(2000);

      // Process markets - upsert by conditionId
      console.log(`[Storage] Processing ${polymarkets.length} markets...`);
      for (const pm of polymarkets) {
        const market = this.convertPolymarketMarket(pm);

        // Upsert market by conditionId (unique constraint)
        await db.insert(markets)
          .values(market)
          .onConflictDoUpdate({
            target: markets.conditionId,
            set: {
              name: market.name,
              category: market.category,
              resolutionTime: market.resolutionTime,
              totalVolume: market.totalVolume,
              isResolved: market.isResolved,
            },
          });
      }

      // Analyze wallets from trades and store in DB
      await this.analyzeWalletsFromTrades(recentTrades);

      // Update market statistics
      await this.updateMarketStats();

      this.lastDataRefresh = now;

      const walletCount = await db.select({ count: count() }).from(wallets);
      const marketCount = await db.select({ count: count() }).from(markets);
      console.log(`[Storage] Refreshed: ${marketCount[0]?.count || 0} markets, ${walletCount[0]?.count || 0} wallets`);
    } catch (error) {
      console.error("[Storage] Failed to refresh data:", error);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Convert Polymarket market to internal format
   */
  private convertPolymarketMarket(pm: PolymarketMarket): InsertMarket {
    return {
      conditionId: pm.conditionId || pm.id,
      name: pm.question || pm.slug,
      category: categorizeMarket(pm),
      resolutionTime: pm.endDate ? new Date(pm.endDate) : null,
      suspiciousWalletCount: 0,
      avgRiskScore: 0,
      totalVolume: pm.volumeNum || 0,
      isResolved: pm.closed,
    };
  }

  /**
   * Analyze wallets from trade data and persist to database
   */
  private async analyzeWalletsFromTrades(trades: PolymarketTrade[]): Promise<void> {
    // Group trades by wallet
    const walletTrades = new Map<string, PolymarketTrade[]>();

    for (const trade of trades) {
      const wallet = trade.proxyWallet;
      if (!wallet) continue;

      const existing = walletTrades.get(wallet) || [];
      existing.push(trade);
      walletTrades.set(wallet, existing);
    }

    console.log(`[Storage] Analyzing ${walletTrades.size} wallets...`);

    let processedCount = 0;

    // Analyze each wallet
    for (const [address, walletTradeList] of Array.from(walletTrades.entries())) {
      const analysis = polymarketClient.analyzeWalletTrades(walletTradeList);

      // Estimate account age based on first trade (heuristic)
      const timestamps = walletTradeList.map((t: PolymarketTrade) => t.timestamp);
      const oldestTrade = Math.min(...timestamps);
      const accountAgeDays = Math.max(1, Math.floor((Date.now() / 1000 - oldestTrade) / 86400));

      const walletMetrics = {
        accountAgeDays,
        winRate: analysis.winRate,
        portfolioConcentration: analysis.marketConcentration,
        avgTimingProximity: Math.round(analysis.avgTimingHours),
        totalVolume: analysis.totalVolume,
      };

      const riskScore = calculateRiskScore(walletMetrics);

      // Only track wallets with some risk indicators
      if (riskScore >= 20 || analysis.totalVolume > 1000) {
        // Upsert wallet by address
        const walletData: InsertWallet = {
          address,
          riskScore,
          winRate: analysis.winRate,
          totalBets: analysis.totalBets,
          totalVolume: analysis.totalVolume,
          currentPositionValue: 0,
          accountAgeDays,
          portfolioConcentration: analysis.marketConcentration,
          avgTimingProximity: Math.round(analysis.avgTimingHours),
          isFlagged: shouldFlagWallet(riskScore),
          notes: null,
        };

        const [insertedWallet] = await db.insert(wallets)
          .values(walletData)
          .onConflictDoUpdate({
            target: wallets.address,
            set: {
              riskScore: walletData.riskScore,
              winRate: walletData.winRate,
              totalBets: walletData.totalBets,
              totalVolume: walletData.totalVolume,
              accountAgeDays: walletData.accountAgeDays,
              portfolioConcentration: walletData.portfolioConcentration,
              avgTimingProximity: walletData.avgTimingProximity,
              isFlagged: walletData.isFlagged,
            },
          })
          .returning();

        // Delete old transactions for this wallet (refresh transactions)
        await db.delete(transactions).where(eq(transactions.walletId, insertedWallet.id));

        // Convert trades to transactions
        for (const trade of walletTradeList) {
          // Find market by conditionId
          const [market] = await db.select()
            .from(markets)
            .where(eq(markets.conditionId, trade.conditionId))
            .limit(1);

          // If market doesn't exist, create it from trade data
          let marketId: string;
          if (!market) {
            const newMarket: InsertMarket = {
              conditionId: trade.conditionId,
              name: trade.title || trade.slug || "Unknown Market",
              category: "Other",
              resolutionTime: null,
              suspiciousWalletCount: 0,
              avgRiskScore: 0,
              totalVolume: 0,
              isResolved: false,
            };

            const [inserted] = await db.insert(markets)
              .values(newMarket)
              .onConflictDoNothing()
              .returning();

            marketId = inserted?.id || randomUUID(); // Fallback to random UUID
          } else {
            marketId = market.id;
          }

          const transaction: InsertTransaction = {
            walletId: insertedWallet.id,
            marketId,
            marketTitle: trade.title, // Store denormalized market title from trade
            amount: trade.size * trade.price,
            direction: trade.outcome || (trade.side === "BUY" ? "Yes" : "No"),
            timestamp: new Date(trade.timestamp * 1000),
            hoursBeforeResolution: Math.round(analysis.avgTimingHours),
            won: null,
            priceImpact: Math.abs(trade.price - 0.5) * 0.1,
          };

          await db.insert(transactions).values(transaction);
        }

        processedCount++;
      }
    }

    console.log(`[Storage] Stored ${processedCount} wallets with risk indicators`);
  }

  /**
   * Update market statistics based on analyzed wallets
   */
  private async updateMarketStats(): Promise<void> {
    // Get all markets
    const allMarkets = await db.select().from(markets);

    for (const market of allMarkets) {
      // Get transactions for this market
      const marketTransactions = await db.select({
        walletId: transactions.walletId,
      })
        .from(transactions)
        .where(eq(transactions.marketId, market.id));

      if (marketTransactions.length === 0) continue;

      // Get unique wallet IDs
      const walletIds = Array.from(new Set(marketTransactions.map(t => t.walletId)));

      if (walletIds.length === 0) continue;

      // Get wallets with risk scores
      const suspiciousWallets = await db.select()
        .from(wallets)
        .where(
          and(
            sql`${wallets.id} = ANY(${walletIds})`,
            sql`${wallets.riskScore} >= ${RISK_THRESHOLDS.MEDIUM}`
          )
        );

      if (suspiciousWallets.length > 0) {
        const avgRiskScore = suspiciousWallets.reduce((sum, w) => sum + w.riskScore, 0) / suspiciousWallets.length;

        await db.update(markets)
          .set({
            suspiciousWalletCount: suspiciousWallets.length,
            avgRiskScore,
          })
          .where(eq(markets.id, market.id));
      }
    }
  }

  // ========== User Methods ==========

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // ========== Wallet Methods ==========

  async getWallets(options?: PaginationOptions): Promise<PaginatedResult<Wallet>> {
    // Trigger refresh if needed
    await this.refreshData();

    const limit = Math.min(
      options?.limit ?? DEFAULT_PAGINATION.limit,
      DEFAULT_PAGINATION.maxLimit
    );
    const offset = options?.offset ?? DEFAULT_PAGINATION.offset;

    const [{ count: total }] = await db.select({ count: count() }).from(wallets);
    const data = await db.select()
      .from(wallets)
      .orderBy(desc(wallets.riskScore))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total: Number(total),
      limit,
      offset,
      hasMore: offset + data.length < Number(total),
    };
  }

  async getFlaggedWallets(options?: PaginationOptions): Promise<PaginatedResult<Wallet>> {
    await this.refreshData();

    const limit = Math.min(
      options?.limit ?? DEFAULT_PAGINATION.limit,
      DEFAULT_PAGINATION.maxLimit
    );
    const offset = options?.offset ?? DEFAULT_PAGINATION.offset;

    const [{ count: total }] = await db.select({ count: count() })
      .from(wallets)
      .where(eq(wallets.isFlagged, true));

    const data = await db.select()
      .from(wallets)
      .where(eq(wallets.isFlagged, true))
      .orderBy(desc(wallets.riskScore))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total: Number(total),
      limit,
      offset,
      hasMore: offset + data.length < Number(total),
    };
  }

  async getHistoricalWallets(options?: PaginationOptions): Promise<PaginatedResult<Wallet>> {
    await this.refreshData();

    const limit = Math.min(
      options?.limit ?? DEFAULT_PAGINATION.limit,
      DEFAULT_PAGINATION.maxLimit
    );
    const offset = options?.offset ?? DEFAULT_PAGINATION.offset;

    const [{ count: total }] = await db.select({ count: count() }).from(wallets);
    const data = await db.select()
      .from(wallets)
      .orderBy(desc(wallets.winRate))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total: Number(total),
      limit,
      offset,
      hasMore: offset + data.length < Number(total),
    };
  }

  async getWallet(id: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, id)).limit(1);
    return wallet;
  }

  async getWalletWithTransactions(id: string): Promise<WalletWithTransactions | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, id)).limit(1);
    if (!wallet) return undefined;

    const walletTransactions = await db.select()
      .from(transactions)
      .where(eq(transactions.walletId, id))
      .orderBy(desc(transactions.timestamp));

    // Get unique market IDs
    const marketIds = Array.from(new Set(walletTransactions.map(t => t.marketId)));

    // Fetch markets
    const walletMarkets = marketIds.length > 0
      ? await db.select()
          .from(markets)
          .where(sql`${markets.id} = ANY(${marketIds})`)
      : [];

    return {
      ...wallet,
      transactions: walletTransactions,
      markets: walletMarkets,
    };
  }

  async getWalletRiskFactors(id: string): Promise<RiskFactors | undefined> {
    const wallet = await this.getWallet(id);
    if (!wallet) return undefined;

    return calculateRiskFactors(wallet);
  }

  async createWallet(wallet: InsertWallet): Promise<Wallet> {
    const [newWallet] = await db.insert(wallets).values(wallet).returning();
    return newWallet;
  }

  // ========== Market Methods ==========

  async getMarkets(options?: PaginationOptions): Promise<PaginatedResult<Market>> {
    await this.refreshData();

    const limit = Math.min(
      options?.limit ?? DEFAULT_PAGINATION.limit,
      DEFAULT_PAGINATION.maxLimit
    );
    const offset = options?.offset ?? DEFAULT_PAGINATION.offset;

    const [{ count: total }] = await db.select({ count: count() }).from(markets);
    const data = await db.select()
      .from(markets)
      .orderBy(desc(markets.suspiciousWalletCount))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total: Number(total),
      limit,
      offset,
      hasMore: offset + data.length < Number(total),
    };
  }

  async getMarket(id: string): Promise<Market | undefined> {
    const [market] = await db.select().from(markets).where(eq(markets.id, id)).limit(1);
    return market;
  }

  async createMarket(market: InsertMarket): Promise<Market> {
    const [newMarket] = await db.insert(markets).values(market).returning();
    return newMarket;
  }

  // ========== Transaction Methods ==========

  async getTransactions(): Promise<Transaction[]> {
    return await db.select()
      .from(transactions)
      .orderBy(desc(transactions.timestamp))
      .limit(100);
  }

  async getTransactionsByWallet(walletId: string): Promise<Transaction[]> {
    return await db.select()
      .from(transactions)
      .where(eq(transactions.walletId, walletId))
      .orderBy(desc(transactions.timestamp));
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }

  // ========== Stats Methods ==========

  async getDashboardStats(): Promise<DashboardStats> {
    await this.refreshData();

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [{ count: totalFlagged }] = await db.select({ count: count() })
      .from(wallets)
      .where(eq(wallets.isFlagged, true));

    const [{ count: highRisk }] = await db.select({ count: count() })
      .from(wallets)
      .where(sql`${wallets.riskScore} >= ${RISK_THRESHOLDS.HIGH}`);

    const [{ count: activeMarkets }] = await db.select({ count: count() })
      .from(markets)
      .where(eq(markets.isResolved, false));

    return {
      totalFlaggedToday: Number(totalFlagged),
      highRiskCount: Number(highRisk),
      activeMarketsMonitored: Number(activeMarkets),
      detectionAccuracy: 0.82, // Placeholder - would need ground truth data
    };
  }

  // ========== Earnings Methods (Pass-through to in-memory for now) ==========

  async getEarningsAlerts(): Promise<EarningsInsiderAlert[]> {
    // TODO: Implement database-backed earnings alerts
    // For now, return empty array since earnings feature is separate
    return [];
  }

  async getEarningsStats(): Promise<EarningsStats> {
    // TODO: Implement database-backed earnings stats
    return {
      totalEarningsTracked: 0,
      matchedMarketsCount: 0,
      highRiskAlertsCount: 0,
      avgDivergence: 0,
    };
  }
}
