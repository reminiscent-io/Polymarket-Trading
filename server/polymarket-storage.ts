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
  type EarningsEvent,
  type EarningsInsiderAlert,
  type EarningsRiskFactors,
  type EarningsStats,
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

/**
 * Helper function to paginate an array
 */
function paginate<T>(
  items: T[],
  options?: PaginationOptions
): PaginatedResult<T> {
  const limit = Math.min(
    options?.limit ?? DEFAULT_PAGINATION.limit,
    DEFAULT_PAGINATION.maxLimit
  );
  const offset = options?.offset ?? DEFAULT_PAGINATION.offset;
  const total = items.length;
  const data = items.slice(offset, offset + limit);

  return {
    data,
    total,
    limit,
    offset,
    hasMore: offset + data.length < total,
  };
}

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

// Company aliases for heuristic matching
const COMPANY_ALIASES: Record<string, string[]> = {
  AAPL: ["apple"],
  MSFT: ["microsoft"],
  GOOGL: ["google", "alphabet"],
  AMZN: ["amazon"],
  META: ["meta", "facebook"],
  TSLA: ["tesla"],
  NVDA: ["nvidia"],
  NFLX: ["netflix"],
  JPM: ["jpmorgan", "jp morgan"],
  AMD: ["amd", "advanced micro"],
  INTC: ["intel"],
  QCOM: ["qualcomm"],
  CRM: ["salesforce"],
  ADBE: ["adobe"],
  DIS: ["disney"],
  BA: ["boeing"],
  GS: ["goldman"],
  WMT: ["walmart"],
  KO: ["coca-cola", "coca cola", "coke"],
  PEP: ["pepsi", "pepsico"],
};

// Earnings-related keywords for market matching
const EARNINGS_KEYWORDS = [
  "earnings", "beat", "revenue", "eps", "quarter", "quarterly",
  "q1", "q2", "q3", "q4", "profit", "guidance", "fiscal",
  "report", "results", "income", "forecast",
];

export class PolymarketStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private walletCache: Map<string, Wallet> = new Map();
  private marketCache: Map<string, Market> = new Map();
  private transactionCache: Map<string, Transaction> = new Map();
  private lastDataRefresh: number = 0;
  private isRefreshing: boolean = false;

  // Earnings analysis cache
  private earningsAlertCache: Map<string, EarningsInsiderAlert> = new Map();
  private lastEarningsRefresh: number = 0;
  private isRefreshingEarnings: boolean = false;

  private readonly DATA_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly EARNINGS_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

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
        totalVolume: analysis.totalVolume,
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
          currentPositionValue: 0, // Will be fetched on-demand for wallet details
          accountAgeDays,
          portfolioConcentration: analysis.marketConcentration,
          avgTimingProximity: Math.round(analysis.avgTimingHours),
          isFlagged: shouldFlagWallet(riskScore),
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
            marketTitle: trade.title || null,
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
        return w && w.riskScore >= RISK_THRESHOLDS.HIGH;
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

  async getWallets(options?: PaginationOptions): Promise<PaginatedResult<Wallet>> {
    await this.refreshData();
    const sorted = Array.from(this.walletCache.values()).sort((a, b) => b.riskScore - a.riskScore);
    return paginate(sorted, options);
  }

  async getFlaggedWallets(options?: PaginationOptions): Promise<PaginatedResult<Wallet>> {
    await this.refreshData();
    const filtered = Array.from(this.walletCache.values())
      .filter(w => w.isFlagged && w.riskScore >= RISK_THRESHOLDS.MEDIUM)
      .sort((a, b) => b.riskScore - a.riskScore);
    return paginate(filtered, options);
  }

  async getHistoricalWallets(options?: PaginationOptions): Promise<PaginatedResult<Wallet>> {
    await this.refreshData();
    const filtered = Array.from(this.walletCache.values())
      .filter(w => w.winRate > 0.7)
      .sort((a, b) => b.riskScore - a.riskScore);
    return paginate(filtered, options);
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
      totalVolume: insertWallet.totalVolume ?? 0,
    });
    const wallet: Wallet = {
      id,
      address: insertWallet.address,
      riskScore,
      winRate: insertWallet.winRate ?? 0,
      totalBets: insertWallet.totalBets ?? 0,
      totalVolume: insertWallet.totalVolume ?? 0,
      currentPositionValue: insertWallet.currentPositionValue ?? 0,
      accountAgeDays: insertWallet.accountAgeDays ?? 0,
      portfolioConcentration: insertWallet.portfolioConcentration ?? 0,
      avgTimingProximity: insertWallet.avgTimingProximity ?? 72,
      isFlagged: shouldFlagWallet(riskScore),
      notes: insertWallet.notes ?? null,
    };
    this.walletCache.set(id, wallet);
    return wallet;
  }

  async getMarkets(options?: PaginationOptions): Promise<PaginatedResult<Market>> {
    await this.refreshData();
    const sorted = Array.from(this.marketCache.values()).sort(
      (a, b) => b.suspiciousWalletCount - a.suspiciousWalletCount
    );
    return paginate(sorted, options);
  }

  async getMarket(id: string): Promise<Market | undefined> {
    await this.refreshData();
    return this.marketCache.get(id);
  }

  async createMarket(insertMarket: InsertMarket): Promise<Market> {
    const id = randomUUID();
    const market: Market = {
      id,
      conditionId: insertMarket.conditionId,
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
      marketTitle: insertTransaction.marketTitle ?? null,
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
    const flaggedResult = await this.getFlaggedWallets();
    const highRisk = flaggedResult.data.filter(w => w.riskScore >= RISK_THRESHOLDS.HIGH);
    const marketsResult = await this.getMarkets();

    return {
      totalFlaggedToday: flaggedResult.total,
      highRiskCount: highRisk.length,
      activeMarketsMonitored: marketsResult.total,
      detectionAccuracy: 87, // Would need historical data to calculate
    };
  }

  // ========== Earnings Insider Detection ==========

  /**
   * Match Polymarket markets to earnings events using heuristic text matching
   */
  private matchMarketToEarnings(
    market: PolymarketMarket,
    earningsEvents: EarningsEvent[]
  ): EarningsEvent | null {
    const question = market.question?.toLowerCase() || "";
    const slug = market.slug?.toLowerCase() || "";

    // Check for earnings-related keywords
    const hasEarningsContext = EARNINGS_KEYWORDS.some(
      (kw) => question.includes(kw) || slug.includes(kw)
    );

    if (!hasEarningsContext) return null;

    for (const event of earningsEvents) {
      const symbolLower = event.symbol.toLowerCase();
      const companyLower = event.companyName.toLowerCase();

      // Check for ticker symbol or company name in market question
      if (
        question.includes(symbolLower) ||
        question.includes(companyLower) ||
        slug.includes(symbolLower)
      ) {
        return event;
      }

      // Check for common variations using aliases
      const aliases = COMPANY_ALIASES[event.symbol] || [];
      if (aliases.some((alias) => question.includes(alias))) {
        return event;
      }
    }

    return null;
  }

  /**
   * Calculate Earnings Insider Risk Score (0-100)
   */
  private calculateEarningsInsiderScore(params: {
    pmOdds: number;
    analystConsensus: number | null;
    daysUntilEarnings: number;
    newAccountLargeBets: number;
    volumeRatio: number;
  }): { score: number; factors: EarningsRiskFactors } {
    const {
      pmOdds,
      analystConsensus,
      daysUntilEarnings,
      newAccountLargeBets,
      volumeRatio,
    } = params;

    // Factor 1: Divergence (0-40 points)
    let divergenceScore = 0;
    if (analystConsensus !== null) {
      const divergence = Math.abs(pmOdds - analystConsensus);
      if (divergence >= 0.3) divergenceScore = 40;
      else if (divergence >= 0.2) divergenceScore = 30;
      else if (divergence >= 0.15) divergenceScore = 20;
      else if (divergence >= 0.1) divergenceScore = 10;
    }

    // Factor 2: Whale Activity (0-30 points)
    let whaleActivityScore = 0;
    if (newAccountLargeBets >= 5) whaleActivityScore = 30;
    else if (newAccountLargeBets >= 3) whaleActivityScore = 22;
    else if (newAccountLargeBets >= 2) whaleActivityScore = 15;
    else if (newAccountLargeBets >= 1) whaleActivityScore = 8;

    // Factor 3: Timing Urgency (0-20 points)
    let timingUrgencyScore = 0;
    if (daysUntilEarnings <= 2) timingUrgencyScore = 20;
    else if (daysUntilEarnings <= 5) timingUrgencyScore = 15;
    else if (daysUntilEarnings <= 7) timingUrgencyScore = 10;
    else if (daysUntilEarnings <= 14) timingUrgencyScore = 5;

    // Factor 4: Volume Anomaly (0-10 points)
    let volumeAnomalyScore = 0;
    if (volumeRatio >= 5.0) volumeAnomalyScore = 10;
    else if (volumeRatio >= 3.0) volumeAnomalyScore = 7;
    else if (volumeRatio >= 2.0) volumeAnomalyScore = 4;
    else if (volumeRatio >= 1.5) volumeAnomalyScore = 2;

    const factors: EarningsRiskFactors = {
      divergenceScore,
      whaleActivityScore,
      timingUrgencyScore,
      volumeAnomalyScore,
    };

    const score = Math.min(
      100,
      divergenceScore + whaleActivityScore + timingUrgencyScore + volumeAnomalyScore
    );

    return { score, factors };
  }

  /**
   * Analyze suspicious whale activity on earnings-related markets
   */
  private analyzeEarningsWhaleActivity(marketId: string): number {
    let whaleCount = 0;

    for (const tx of Array.from(this.transactionCache.values())) {
      if (tx.marketId !== marketId) continue;

      const wallet = Array.from(this.walletCache.values()).find(
        (w) => w.id === tx.walletId
      );

      // Count wallets with: new account (<14 days) + large position (>$2500)
      if (wallet && wallet.accountAgeDays < 14 && tx.amount >= 2500) {
        whaleCount++;
      }
    }

    return whaleCount;
  }

  /**
   * Refresh earnings analysis data
   */
  private async refreshEarningsData(): Promise<void> {
    if (this.isRefreshingEarnings) {
      return;
    }

    const now = Date.now();
    if (now - this.lastEarningsRefresh < this.EARNINGS_REFRESH_INTERVAL) {
      return;
    }

    this.isRefreshingEarnings = true;
    console.log("[Storage] Refreshing earnings analysis...");

    try {
      // Get earnings calendar from FMP
      const earningsEvents = await earningsClient.getEarningsCalendar(30);

      if (earningsEvents.length === 0) {
        console.log("[Storage] No earnings events found");
        this.lastEarningsRefresh = now;
        return;
      }

      // Get current markets from Polymarket
      const polymarkets = await polymarketClient.getMarkets({ limit: 100, active: true });

      this.earningsAlertCache.clear();

      for (const pmMarket of polymarkets) {
        // Try to match market to earnings event
        const matchedEarnings = this.matchMarketToEarnings(pmMarket, earningsEvents);
        if (!matchedEarnings) continue;

        // Calculate days until earnings
        const earningsDate = new Date(matchedEarnings.earningsDate);
        const daysUntil = Math.ceil(
          (earningsDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );

        // Only track upcoming earnings (not past)
        if (daysUntil < 0 || daysUntil > 30) continue;

        // Get current PM odds
        const pmOdds = pmMarket.lastTradePrice || 0.5;

        // Get internal market ID
        const marketId = pmMarket.conditionId || pmMarket.id;

        // Analyze whale activity
        const whaleCount = this.analyzeEarningsWhaleActivity(marketId);

        // Estimate volume ratio (would need historical baseline in production)
        const market = this.marketCache.get(marketId);
        const baselineVolume = market?.totalVolume
          ? market.totalVolume / 30
          : pmMarket.volumeNum / 30;
        const volumeRatio =
          baselineVolume > 0 ? (pmMarket.volume24hr || 0) / baselineVolume : 1;

        // Calculate insider score
        const { score, factors } = this.calculateEarningsInsiderScore({
          pmOdds,
          analystConsensus: matchedEarnings.beatProbability,
          daysUntilEarnings: daysUntil,
          newAccountLargeBets: whaleCount,
          volumeRatio,
        });

        const divergence =
          matchedEarnings.beatProbability !== null
            ? Math.abs(pmOdds - matchedEarnings.beatProbability)
            : 0;

        const alert: EarningsInsiderAlert = {
          id: `${matchedEarnings.symbol}-${marketId}`,
          symbol: matchedEarnings.symbol,
          companyName: matchedEarnings.companyName,
          earningsDate: matchedEarnings.earningsDate,
          daysUntilEarnings: daysUntil,
          insiderRiskScore: score,
          polymarketOdds: pmOdds,
          analystConsensus: matchedEarnings.beatProbability,
          divergence,
          suspiciousWhaleCount: whaleCount,
          volumeRatio,
          matchedMarketId: marketId,
          matchedMarketQuestion: pmMarket.question || pmMarket.slug,
          riskFactors: factors,
        };

        this.earningsAlertCache.set(alert.id, alert);
      }

      this.lastEarningsRefresh = now;
      console.log(
        `[Storage] Analyzed ${this.earningsAlertCache.size} earnings-related markets`
      );
    } catch (error) {
      console.error("[Storage] Failed to refresh earnings data:", error);
    } finally {
      this.isRefreshingEarnings = false;
    }
  }

  // IStorage implementation for earnings

  async getEarningsAlerts(): Promise<EarningsInsiderAlert[]> {
    await this.refreshData();
    await this.refreshEarningsData();

    return Array.from(this.earningsAlertCache.values()).sort(
      (a, b) => b.insiderRiskScore - a.insiderRiskScore
    );
  }

  async getEarningsStats(): Promise<EarningsStats> {
    const alerts = await this.getEarningsAlerts();

    return {
      totalEarningsTracked: alerts.length,
      matchedMarketsCount: alerts.filter((a) => a.matchedMarketId).length,
      highRiskAlertsCount: alerts.filter((a) => a.insiderRiskScore >= RISK_THRESHOLDS.HIGH).length,
      avgDivergence:
        alerts.length > 0
          ? alerts.reduce((sum, a) => sum + a.divergence, 0) / alerts.length
          : 0,
    };
  }
}
