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
} from "@shared/schema";
import { randomUUID } from "crypto";
import { type IStorage } from "./storage-interface";

export type { IStorage };

function generateWalletAddress(): string {
  const chars = "0123456789abcdef";
  let address = "0x";
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
}

function calculateRiskScore(wallet: Partial<InsertWallet>): number {
  let score = 0;

  // Account Age (0-20 points)
  const ageDays = wallet.accountAgeDays ?? 30;
  if (ageDays < 7) score += 20;
  else if (ageDays < 14) score += 15;
  else if (ageDays < 30) score += 8;

  // Win Rate (0-20 points)
  const winRate = wallet.winRate ?? 0.5;
  if (winRate > 0.85) score += 20;
  else if (winRate > 0.7) score += 15;
  else if (winRate > 0.6) score += 8;

  // Portfolio Concentration (0-20 points)
  const concentration = wallet.portfolioConcentration ?? 0.3;
  if (concentration > 0.8) score += 20;
  else if (concentration > 0.6) score += 15;
  else if (concentration > 0.4) score += 8;

  // Timing Proximity (0-20 points)
  const timing = wallet.avgTimingProximity ?? 72;
  if (timing < 24) score += 20;
  else if (timing < 48) score += 15;
  else if (timing < 72) score += 8;

  // Position Size (0-20 points)
  const volume = wallet.totalVolume ?? 0;
  if (volume >= 10000) score += 20;
  else if (volume >= 2500) score += 15;
  else if (volume >= 500) score += 8;
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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private wallets: Map<string, Wallet>;
  private markets: Map<string, Market>;
  private transactions: Map<string, Transaction>;

  constructor() {
    this.users = new Map();
    this.wallets = new Map();
    this.markets = new Map();
    this.transactions = new Map();
    this.seedData();
  }

  private seedData() {
    const marketData = [
      { name: "Will Bitcoin reach $100k by end of 2026?", category: "Crypto" },
      { name: "US Presidential Election 2028 - Democratic Nominee", category: "Politics" },
      { name: "Super Bowl 2026 Winner", category: "Sports" },
      { name: "Will Fed cut rates in Q1 2026?", category: "Finance" },
      { name: "Oscar Best Picture 2026", category: "Entertainment" },
      { name: "Will GPT-5 be released in 2026?", category: "Technology" },
      { name: "Will Tesla stock hit $500 by December?", category: "Finance" },
      { name: "NBA Finals 2026 Champion", category: "Sports" },
      { name: "Will Congress pass new crypto regulation?", category: "Politics" },
      { name: "Ethereum merge to proof of stake successful?", category: "Crypto" },
    ];

    const createdMarkets: Market[] = [];
    marketData.forEach((m) => {
      const id = randomUUID();
      const resolutionDate = new Date();
      resolutionDate.setDate(resolutionDate.getDate() + Math.floor(Math.random() * 90) + 10);

      const market: Market = {
        id,
        name: m.name,
        category: m.category,
        resolutionTime: resolutionDate,
        suspiciousWalletCount: 0,
        avgRiskScore: 0,
        totalVolume: Math.floor(Math.random() * 500000) + 50000,
        isResolved: false,
      };
      this.markets.set(id, market);
      createdMarkets.push(market);
    });

    const walletProfiles = [
      { ageDays: 3, winRate: 0.92, concentration: 0.85, timing: 18, volume: 125000, bets: 12 },
      { ageDays: 5, winRate: 0.88, concentration: 0.78, timing: 24, volume: 89000, bets: 8 },
      { ageDays: 2, winRate: 0.95, concentration: 0.92, timing: 12, volume: 210000, bets: 6 },
      { ageDays: 7, winRate: 0.82, concentration: 0.65, timing: 36, volume: 67000, bets: 15 },
      { ageDays: 4, winRate: 0.9, concentration: 0.72, timing: 20, volume: 145000, bets: 10 },
      { ageDays: 10, winRate: 0.75, concentration: 0.55, timing: 48, volume: 45000, bets: 20 },
      { ageDays: 6, winRate: 0.85, concentration: 0.68, timing: 28, volume: 98000, bets: 14 },
      { ageDays: 1, winRate: 0.97, concentration: 0.95, timing: 8, volume: 320000, bets: 4 },
      { ageDays: 8, winRate: 0.78, concentration: 0.58, timing: 42, volume: 56000, bets: 18 },
      { ageDays: 12, winRate: 0.72, concentration: 0.48, timing: 56, volume: 38000, bets: 22 },
      { ageDays: 15, winRate: 0.68, concentration: 0.42, timing: 60, volume: 28000, bets: 25 },
      { ageDays: 9, winRate: 0.8, concentration: 0.62, timing: 38, volume: 72000, bets: 16 },
      { ageDays: 3, winRate: 0.89, concentration: 0.82, timing: 22, volume: 115000, bets: 9 },
      { ageDays: 6, winRate: 0.84, concentration: 0.7, timing: 32, volume: 88000, bets: 13 },
      { ageDays: 4, winRate: 0.91, concentration: 0.76, timing: 16, volume: 178000, bets: 7 },
      { ageDays: 20, winRate: 0.65, concentration: 0.35, timing: 72, volume: 22000, bets: 30 },
      { ageDays: 25, winRate: 0.62, concentration: 0.28, timing: 80, volume: 18000, bets: 35 },
      { ageDays: 11, winRate: 0.74, concentration: 0.52, timing: 50, volume: 42000, bets: 19 },
      { ageDays: 2, winRate: 0.94, concentration: 0.88, timing: 14, volume: 195000, bets: 5 },
      { ageDays: 7, winRate: 0.81, concentration: 0.64, timing: 34, volume: 62000, bets: 17 },
    ];

    const createdWallets: Wallet[] = [];
    walletProfiles.forEach((profile) => {
      const id = randomUUID();
      const walletMetrics = {
        accountAgeDays: profile.ageDays,
        winRate: profile.winRate,
        portfolioConcentration: profile.concentration,
        avgTimingProximity: profile.timing,
      };

      const riskScore = calculateRiskScore(walletMetrics);
      // Generate realistic position value (20-60% of total volume for active wallets)
      const positionValueRatio = 0.2 + Math.random() * 0.4;
      const wallet: Wallet = {
        id,
        address: generateWalletAddress(),
        riskScore,
        winRate: profile.winRate,
        totalBets: profile.bets,
        totalVolume: profile.volume,
        currentPositionValue: Math.floor(profile.volume * positionValueRatio),
        accountAgeDays: profile.ageDays,
        portfolioConcentration: profile.concentration,
        avgTimingProximity: profile.timing,
        isFlagged: riskScore >= 40,
        notes: null,
      };

      this.wallets.set(id, wallet);
      createdWallets.push(wallet);
    });

    createdWallets.forEach((wallet) => {
      const numTransactions = Math.floor(Math.random() * 6) + 3;
      const usedMarkets = new Set<string>();

      for (let i = 0; i < numTransactions; i++) {
        let market: Market;
        do {
          market = createdMarkets[Math.floor(Math.random() * createdMarkets.length)];
        } while (usedMarkets.has(market.id) && usedMarkets.size < createdMarkets.length);

        usedMarkets.add(market.id);

        const txDate = new Date();
        txDate.setDate(txDate.getDate() - Math.floor(Math.random() * 30));

        const tx: Transaction = {
          id: randomUUID(),
          walletId: wallet.id,
          marketId: market.id,
          amount: Math.floor(Math.random() * 20000) + 1000,
          direction: Math.random() > 0.5 ? "Yes" : "No",
          timestamp: txDate,
          hoursBeforeResolution: wallet.avgTimingProximity + Math.floor(Math.random() * 24) - 12,
          won: Math.random() < wallet.winRate ? true : Math.random() > 0.7 ? false : null,
          priceImpact: Math.random() * 0.05,
        };

        this.transactions.set(tx.id, tx);
      }
    });

    createdMarkets.forEach((market) => {
      const marketTransactions = Array.from(this.transactions.values()).filter(
        (t) => t.marketId === market.id
      );
      const walletIds = new Set(marketTransactions.map((t) => t.walletId));
      const suspiciousWallets = Array.from(walletIds).filter((wid) => {
        const w = this.wallets.get(wid);
        return w && w.riskScore >= 60;
      });

      const avgRisk =
        suspiciousWallets.length > 0
          ? suspiciousWallets.reduce((sum, wid) => sum + (this.wallets.get(wid)?.riskScore ?? 0), 0) /
            suspiciousWallets.length
          : 0;

      market.suspiciousWalletCount = suspiciousWallets.length;
      market.avgRiskScore = avgRisk;
      this.markets.set(market.id, market);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getWallets(): Promise<Wallet[]> {
    return Array.from(this.wallets.values()).sort((a, b) => b.riskScore - a.riskScore);
  }

  async getFlaggedWallets(): Promise<Wallet[]> {
    return Array.from(this.wallets.values())
      .filter((w) => w.isFlagged && w.riskScore >= 40)
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  async getHistoricalWallets(): Promise<Wallet[]> {
    return Array.from(this.wallets.values())
      .filter((w) => w.winRate > 0.7)
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  async getWallet(id: string): Promise<Wallet | undefined> {
    return this.wallets.get(id);
  }

  async getWalletWithTransactions(id: string): Promise<WalletWithTransactions | undefined> {
    const wallet = this.wallets.get(id);
    if (!wallet) return undefined;

    const transactions = await this.getTransactionsByWallet(id);
    const marketIds = new Set(transactions.map((t) => t.marketId));
    const markets = Array.from(this.markets.values()).filter((m) => marketIds.has(m.id));

    return {
      ...wallet,
      transactions,
      markets,
    };
  }

  async getWalletRiskFactors(id: string): Promise<RiskFactors | undefined> {
    const wallet = this.wallets.get(id);
    if (!wallet) return undefined;
    return calculateRiskFactors(wallet);
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const id = randomUUID();
    const riskScore = calculateRiskScore(insertWallet);
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
    this.wallets.set(id, wallet);
    return wallet;
  }

  async getMarkets(): Promise<Market[]> {
    return Array.from(this.markets.values()).sort(
      (a, b) => b.suspiciousWalletCount - a.suspiciousWalletCount
    );
  }

  async getMarket(id: string): Promise<Market | undefined> {
    return this.markets.get(id);
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
    this.markets.set(id, market);
    return market;
  }

  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async getTransactionsByWallet(walletId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter((t) => t.walletId === walletId)
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
    this.transactions.set(id, transaction);
    return transaction;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const flagged = await this.getFlaggedWallets();
    const highRisk = flagged.filter((w) => w.riskScore >= 60);
    const markets = await this.getMarkets();

    return {
      totalFlaggedToday: flagged.length,
      highRiskCount: highRisk.length,
      activeMarketsMonitored: markets.length,
      detectionAccuracy: 87,
    };
  }

  // Mock earnings data for development/testing
  async getEarningsAlerts(): Promise<EarningsInsiderAlert[]> {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    return [
      {
        id: "AAPL-mock-1",
        symbol: "AAPL",
        companyName: "Apple Inc.",
        earningsDate: new Date(now + 5 * day).toISOString().split("T")[0],
        daysUntilEarnings: 5,
        insiderRiskScore: 72,
        polymarketOdds: 0.68,
        analystConsensus: 0.45,
        divergence: 0.23,
        suspiciousWhaleCount: 3,
        volumeRatio: 2.8,
        matchedMarketId: "mock-market-1",
        matchedMarketQuestion: "Will Apple beat Q1 2026 earnings estimates?",
        riskFactors: {
          divergenceScore: 30,
          whaleActivityScore: 22,
          timingUrgencyScore: 15,
          volumeAnomalyScore: 5,
        },
      },
      {
        id: "TSLA-mock-2",
        symbol: "TSLA",
        companyName: "Tesla Inc.",
        earningsDate: new Date(now + 2 * day).toISOString().split("T")[0],
        daysUntilEarnings: 2,
        insiderRiskScore: 85,
        polymarketOdds: 0.78,
        analystConsensus: 0.42,
        divergence: 0.36,
        suspiciousWhaleCount: 5,
        volumeRatio: 4.2,
        matchedMarketId: "mock-market-2",
        matchedMarketQuestion: "Will Tesla beat Q4 earnings?",
        riskFactors: {
          divergenceScore: 40,
          whaleActivityScore: 30,
          timingUrgencyScore: 20,
          volumeAnomalyScore: 7,
        },
      },
      {
        id: "NVDA-mock-3",
        symbol: "NVDA",
        companyName: "NVIDIA Corporation",
        earningsDate: new Date(now + 12 * day).toISOString().split("T")[0],
        daysUntilEarnings: 12,
        insiderRiskScore: 58,
        polymarketOdds: 0.82,
        analystConsensus: 0.68,
        divergence: 0.14,
        suspiciousWhaleCount: 2,
        volumeRatio: 1.8,
        matchedMarketId: "mock-market-3",
        matchedMarketQuestion: "Will NVIDIA beat Q1 2026 earnings?",
        riskFactors: {
          divergenceScore: 20,
          whaleActivityScore: 15,
          timingUrgencyScore: 5,
          volumeAnomalyScore: 4,
        },
      },
      {
        id: "MSFT-mock-4",
        symbol: "MSFT",
        companyName: "Microsoft Corporation",
        earningsDate: new Date(now + 3 * day).toISOString().split("T")[0],
        daysUntilEarnings: 3,
        insiderRiskScore: 65,
        polymarketOdds: 0.72,
        analystConsensus: 0.55,
        divergence: 0.17,
        suspiciousWhaleCount: 4,
        volumeRatio: 2.3,
        matchedMarketId: "mock-market-4",
        matchedMarketQuestion: "Will Microsoft beat earnings estimates?",
        riskFactors: {
          divergenceScore: 20,
          whaleActivityScore: 22,
          timingUrgencyScore: 15,
          volumeAnomalyScore: 4,
        },
      },
      {
        id: "GOOGL-mock-5",
        symbol: "GOOGL",
        companyName: "Alphabet Inc.",
        earningsDate: new Date(now + 7 * day).toISOString().split("T")[0],
        daysUntilEarnings: 7,
        insiderRiskScore: 48,
        polymarketOdds: 0.58,
        analystConsensus: 0.62,
        divergence: 0.04,
        suspiciousWhaleCount: 1,
        volumeRatio: 1.4,
        matchedMarketId: "mock-market-5",
        matchedMarketQuestion: "Will Google beat Q1 earnings?",
        riskFactors: {
          divergenceScore: 0,
          whaleActivityScore: 8,
          timingUrgencyScore: 10,
          volumeAnomalyScore: 0,
        },
      },
      {
        id: "META-mock-6",
        symbol: "META",
        companyName: "Meta Platforms Inc.",
        earningsDate: new Date(now + 8 * day).toISOString().split("T")[0],
        daysUntilEarnings: 8,
        insiderRiskScore: 55,
        polymarketOdds: 0.65,
        analystConsensus: 0.50,
        divergence: 0.15,
        suspiciousWhaleCount: 2,
        volumeRatio: 2.1,
        matchedMarketId: "mock-market-6",
        matchedMarketQuestion: "Will Meta beat Q1 2026 earnings?",
        riskFactors: {
          divergenceScore: 20,
          whaleActivityScore: 15,
          timingUrgencyScore: 5,
          volumeAnomalyScore: 4,
        },
      },
    ].sort((a, b) => b.insiderRiskScore - a.insiderRiskScore);
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

import { PolymarketStorage } from "./polymarket-storage";

// Use live Polymarket data by default, fall back to mock data with MOCK_DATA=true
const useLiveData = process.env.MOCK_DATA !== "true";

export const storage: IStorage = useLiveData
  ? new PolymarketStorage()
  : new MemStorage();

console.log(`[Storage] Using ${useLiveData ? "LIVE Polymarket" : "MOCK"} data mode`);
