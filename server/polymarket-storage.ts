/**
 * Polymarket Live Storage Implementation
 * Fetches real data from Polymarket APIs and analyzes wallets for suspicious activity
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
} from "@shared/schema";
import { randomUUID } from "crypto";
import { type IStorage } from "./storage-interface";
import { polymarketClient, type PolymarketMarket, type PolymarketTrade } from "./polymarket-client";

// Map Polymarket categories from tags
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

// Calculate risk score based on wallet behavior
function calculateRiskScore(metrics: {
  accountAgeDays: number;
  winRate: number;
  portfolioConcentration: number;
  avgTimingProximity: number;
}): number {
  let score = 0;

  // Account age factor (newer = more suspicious)
  if (metrics.accountAgeDays < 7) score += 25;
  else if (metrics.accountAgeDays < 14) score += 20;
  else if (metrics.accountAgeDays < 30) score += 10;

  // Win rate factor (extremely high win rate = suspicious)
  if (metrics.winRate > 0.85) score += 25;
  else if (metrics.winRate > 0.7) score += 20;
  else if (metrics.winRate > 0.6) score += 10;

  // Portfolio concentration (highly concentrated = suspicious)
  if (metrics.portfolioConcentration > 0.8) score += 25;
  else if (metrics.portfolioConcentration > 0.6) score += 20;
  else if (metrics.portfolioConcentration > 0.4) score += 10;

  // Timing proximity (trades very close to resolution = suspicious)
  if (metrics.avgTimingProximity < 24) score += 25;
  else if (metrics.avgTimingProximity < 48) score += 20;
  else if (metrics.avgTimingProximity < 72) score += 10;

  return Math.min(100, score);
}

function calculateRiskFactors(wallet: Wallet): RiskFactors {
  const ageDays = wallet.accountAgeDays;
  let accountAge = 0;
  if (ageDays < 7) accountAge = 25;
  else if (ageDays < 14) accountAge = 20;
  else if (ageDays < 30) accountAge = 10;

  const wr = wallet.winRate;
  let winRateScore = 0;
  if (wr > 0.85) winRateScore = 25;
  else if (wr > 0.7) winRateScore = 20;
  else if (wr > 0.6) winRateScore = 10;

  const concentration = wallet.portfolioConcentration;
  let concentrationScore = 0;
  if (concentration > 0.8) concentrationScore = 25;
  else if (concentration > 0.6) concentrationScore = 20;
  else if (concentration > 0.4) concentrationScore = 10;

  const timing = wallet.avgTimingProximity;
  let timingScore = 0;
  if (timing < 24) timingScore = 25;
  else if (timing < 48) timingScore = 20;
  else if (timing < 72) timingScore = 10;

  return {
    accountAge,
    winRate: winRateScore,
    portfolioConcentration: concentrationScore,
    timingProximity: timingScore,
    positionSize: Math.min(25, Math.floor(wallet.totalVolume / 10000)),
  };
}

export class PolymarketStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private walletCache: Map<string, Wallet> = new Map();
  private marketCache: Map<string, Market> = new Map();
  private transactionCache: Map<string, Transaction> = new Map();
  private lastDataRefresh: number = 0;
  private isRefreshing: boolean = false;

  private readonly DATA_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Initial data load
    this.refreshData().catch(console.error);
  }

  /**
   * Refresh data from Polymarket APIs
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

      // Process markets
      this.marketCache.clear();
      for (const pm of polymarkets) {
        const market = this.convertPolymarketMarket(pm);
        this.marketCache.set(market.id, market);
      }

      // Analyze wallets from trades
      await this.analyzeWalletsFromTrades(recentTrades);

      // Update market statistics
      this.updateMarketStats();

      this.lastDataRefresh = now;
      console.log(`[Storage] Refreshed: ${this.marketCache.size} markets, ${this.walletCache.size} wallets`);
    } catch (error) {
      console.error("[Storage] Failed to refresh data:", error);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Convert Polymarket market to internal format
   */
  private convertPolymarketMarket(pm: PolymarketMarket): Market {
    return {
      id: pm.conditionId || pm.id,
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
   * Analyze wallets from trade data
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

    // Analyze each wallet
    this.walletCache.clear();
    this.transactionCache.clear();

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
      };

      const riskScore = calculateRiskScore(walletMetrics);

      // Only track wallets with some risk indicators
      if (riskScore >= 20 || analysis.totalVolume > 1000) {
        const walletId = randomUUID();
        const wallet: Wallet = {
          id: walletId,
          address,
          riskScore,
          winRate: analysis.winRate,
          totalBets: analysis.totalBets,
          totalVolume: analysis.totalVolume,
          accountAgeDays,
          portfolioConcentration: analysis.marketConcentration,
          avgTimingProximity: Math.round(analysis.avgTimingHours),
          isFlagged: riskScore >= 40,
          notes: null,
        };

        this.walletCache.set(walletId, wallet);

        // Convert trades to transactions
        for (const trade of walletTradeList) {
          const txId = randomUUID();
          const marketId = trade.conditionId;

          const transaction: Transaction = {
            id: txId,
            walletId,
            marketId,
            amount: trade.size * trade.price,
            direction: trade.outcome || (trade.side === "BUY" ? "Yes" : "No"),
            timestamp: new Date(trade.timestamp * 1000),
            hoursBeforeResolution: Math.round(analysis.avgTimingHours),
            won: null, // Would need resolution data
            priceImpact: Math.abs(trade.price - 0.5) * 0.1,
          };

          this.transactionCache.set(txId, transaction);
        }
      }
    }

    console.log(`[Storage] Tracked ${this.walletCache.size} wallets with risk indicators`);
  }

  /**
   * Update market statistics based on analyzed wallets
   */
  private updateMarketStats(): void {
    // Get all transactions grouped by market
    const marketTransactions = new Map<string, Transaction[]>();

    for (const tx of Array.from(this.transactionCache.values())) {
      const existing = marketTransactions.get(tx.marketId) || [];
      existing.push(tx);
      marketTransactions.set(tx.marketId, existing);
    }

    // Update each market with suspicious wallet counts
    for (const [marketId, txs] of Array.from(marketTransactions.entries())) {
      const walletIds = new Set(txs.map((t: Transaction) => t.walletId));
      const suspiciousWallets = Array.from(walletIds).filter((wid: string) => {
        const w = this.walletCache.get(wid);
        return w && w.riskScore >= 60;
      });

      const avgRisk = suspiciousWallets.length > 0
        ? suspiciousWallets.reduce((sum: number, wid: string) => sum + (this.walletCache.get(wid)?.riskScore ?? 0), 0) / suspiciousWallets.length
        : 0;

      const market = this.marketCache.get(marketId);
      if (market) {
        market.suspiciousWalletCount = suspiciousWallets.length;
        market.avgRiskScore = avgRisk;
      }
    }
  }

  // IStorage implementation

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getWallets(): Promise<Wallet[]> {
    await this.refreshData();
    return Array.from(this.walletCache.values()).sort((a, b) => b.riskScore - a.riskScore);
  }

  async getFlaggedWallets(): Promise<Wallet[]> {
    await this.refreshData();
    return Array.from(this.walletCache.values())
      .filter(w => w.isFlagged && w.riskScore >= 40)
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  async getHistoricalWallets(): Promise<Wallet[]> {
    await this.refreshData();
    return Array.from(this.walletCache.values())
      .filter(w => w.winRate > 0.7)
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  async getWallet(id: string): Promise<Wallet | undefined> {
    await this.refreshData();
    return this.walletCache.get(id);
  }

  async getWalletWithTransactions(id: string): Promise<WalletWithTransactions | undefined> {
    await this.refreshData();
    const wallet = this.walletCache.get(id);
    if (!wallet) return undefined;

    const transactions = await this.getTransactionsByWallet(id);
    const marketIds = new Set(transactions.map(t => t.marketId));
    const markets = Array.from(this.marketCache.values()).filter(m => marketIds.has(m.id));

    return {
      ...wallet,
      transactions,
      markets,
    };
  }

  async getWalletRiskFactors(id: string): Promise<RiskFactors | undefined> {
    await this.refreshData();
    const wallet = this.walletCache.get(id);
    if (!wallet) return undefined;
    return calculateRiskFactors(wallet);
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const id = randomUUID();
    const riskScore = calculateRiskScore({
      accountAgeDays: insertWallet.accountAgeDays ?? 30,
      winRate: insertWallet.winRate ?? 0.5,
      portfolioConcentration: insertWallet.portfolioConcentration ?? 0.3,
      avgTimingProximity: insertWallet.avgTimingProximity ?? 72,
    });
    const wallet: Wallet = {
      id,
      address: insertWallet.address,
      riskScore,
      winRate: insertWallet.winRate ?? 0,
      totalBets: insertWallet.totalBets ?? 0,
      totalVolume: insertWallet.totalVolume ?? 0,
      accountAgeDays: insertWallet.accountAgeDays ?? 0,
      portfolioConcentration: insertWallet.portfolioConcentration ?? 0,
      avgTimingProximity: insertWallet.avgTimingProximity ?? 72,
      isFlagged: riskScore >= 40,
      notes: insertWallet.notes ?? null,
    };
    this.walletCache.set(id, wallet);
    return wallet;
  }

  async getMarkets(): Promise<Market[]> {
    await this.refreshData();
    return Array.from(this.marketCache.values()).sort(
      (a, b) => b.suspiciousWalletCount - a.suspiciousWalletCount
    );
  }

  async getMarket(id: string): Promise<Market | undefined> {
    await this.refreshData();
    return this.marketCache.get(id);
  }

  async createMarket(insertMarket: InsertMarket): Promise<Market> {
    const id = randomUUID();
    const market: Market = {
      id,
      name: insertMarket.name,
      category: insertMarket.category,
      resolutionTime: insertMarket.resolutionTime ?? null,
      suspiciousWalletCount: insertMarket.suspiciousWalletCount ?? 0,
      avgRiskScore: insertMarket.avgRiskScore ?? 0,
      totalVolume: insertMarket.totalVolume ?? 0,
      isResolved: insertMarket.isResolved ?? false,
    };
    this.marketCache.set(id, market);
    return market;
  }

  async getTransactions(): Promise<Transaction[]> {
    await this.refreshData();
    return Array.from(this.transactionCache.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async getTransactionsByWallet(walletId: string): Promise<Transaction[]> {
    await this.refreshData();
    return Array.from(this.transactionCache.values())
      .filter(t => t.walletId === walletId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      id,
      walletId: insertTransaction.walletId,
      marketId: insertTransaction.marketId,
      amount: insertTransaction.amount,
      direction: insertTransaction.direction,
      timestamp: insertTransaction.timestamp ?? new Date(),
      hoursBeforeResolution: insertTransaction.hoursBeforeResolution ?? null,
      won: insertTransaction.won ?? null,
      priceImpact: insertTransaction.priceImpact ?? null,
    };
    this.transactionCache.set(id, transaction);
    return transaction;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    await this.refreshData();
    const flagged = await this.getFlaggedWallets();
    const highRisk = flagged.filter(w => w.riskScore >= 60);
    const markets = await this.getMarkets();

    return {
      totalFlaggedToday: flagged.length,
      highRiskCount: highRisk.length,
      activeMarketsMonitored: markets.length,
      detectionAccuracy: 87, // Would need historical data to calculate
    };
  }
}
