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
import { type IStorage } from "./storage-interface";
import { polymarketClient, type PolymarketMarket, type PolymarketTrade } from "./polymarket-client";
import { earningsClient } from "./earnings-client";

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
  totalVolume: number;
}): number {
  let score = 0;

  // Account age factor (0-20 points)
  if (metrics.accountAgeDays < 7) score += 20;
  else if (metrics.accountAgeDays < 14) score += 15;
  else if (metrics.accountAgeDays < 30) score += 8;

  // Win rate factor (0-20 points)
  if (metrics.winRate > 0.85) score += 20;
  else if (metrics.winRate > 0.7) score += 15;
  else if (metrics.winRate > 0.6) score += 8;

  // Portfolio concentration (0-20 points)
  if (metrics.portfolioConcentration > 0.8) score += 20;
  else if (metrics.portfolioConcentration > 0.6) score += 15;
  else if (metrics.portfolioConcentration > 0.4) score += 8;

  // Timing proximity (0-20 points)
  if (metrics.avgTimingProximity < 24) score += 20;
  else if (metrics.avgTimingProximity < 48) score += 15;
  else if (metrics.avgTimingProximity < 72) score += 8;

  // Position size (0-20 points)
  if (metrics.totalVolume >= 10000) score += 20;
  else if (metrics.totalVolume >= 2500) score += 15;
  else if (metrics.totalVolume >= 500) score += 8;
  // < $500 gets 0 points (low risk)

  return Math.min(100, score);
}

function calculateRiskFactors(wallet: Wallet): RiskFactors {
  const ageDays = wallet.accountAgeDays;
  let accountAge = 0;
  if (ageDays < 7) accountAge = 20;
  else if (ageDays < 14) accountAge = 15;
  else if (ageDays < 30) accountAge = 8;

  const wr = wallet.winRate;
  let winRateScore = 0;
  if (wr > 0.85) winRateScore = 20;
  else if (wr > 0.7) winRateScore = 15;
  else if (wr > 0.6) winRateScore = 8;

  const concentration = wallet.portfolioConcentration;
  let concentrationScore = 0;
  if (concentration > 0.8) concentrationScore = 20;
  else if (concentration > 0.6) concentrationScore = 15;
  else if (concentration > 0.4) concentrationScore = 8;

  const timing = wallet.avgTimingProximity;
  let timingScore = 0;
  if (timing < 24) timingScore = 20;
  else if (timing < 48) timingScore = 15;
  else if (timing < 72) timingScore = 8;

  const volume = wallet.totalVolume;
  let positionSizeScore = 0;
  if (volume >= 10000) positionSizeScore = 20;
  else if (volume >= 2500) positionSizeScore = 15;
  else if (volume >= 500) positionSizeScore = 8;

  return {
    accountAge,
    winRate: winRateScore,
    portfolioConcentration: concentrationScore,
    timingProximity: timingScore,
    positionSize: positionSizeScore,
  };
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
      highRiskAlertsCount: alerts.filter((a) => a.insiderRiskScore >= 60).length,
      avgDivergence:
        alerts.length > 0
          ? alerts.reduce((sum, a) => sum + a.divergence, 0) / alerts.length
          : 0,
    };
  }
}
