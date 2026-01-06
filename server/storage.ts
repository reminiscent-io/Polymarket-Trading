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

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getWallets(): Promise<Wallet[]>;
  getFlaggedWallets(): Promise<Wallet[]>;
  getHistoricalWallets(): Promise<Wallet[]>;
  getWallet(id: string): Promise<Wallet | undefined>;
  getWalletWithTransactions(id: string): Promise<WalletWithTransactions | undefined>;
  getWalletRiskFactors(id: string): Promise<RiskFactors | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;

  getMarkets(): Promise<Market[]>;
  getMarket(id: string): Promise<Market | undefined>;
  createMarket(market: InsertMarket): Promise<Market>;

  getTransactions(): Promise<Transaction[]>;
  getTransactionsByWallet(walletId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;

  getDashboardStats(): Promise<DashboardStats>;
}

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

  const ageDays = wallet.accountAgeDays ?? 30;
  if (ageDays < 7) score += 25;
  else if (ageDays < 14) score += 20;
  else if (ageDays < 30) score += 10;

  const winRate = wallet.winRate ?? 0.5;
  if (winRate > 0.85) score += 25;
  else if (winRate > 0.7) score += 20;
  else if (winRate > 0.6) score += 10;

  const concentration = wallet.portfolioConcentration ?? 0.3;
  if (concentration > 0.8) score += 25;
  else if (concentration > 0.6) score += 20;
  else if (concentration > 0.4) score += 10;

  const timing = wallet.avgTimingProximity ?? 72;
  if (timing < 24) score += 25;
  else if (timing < 48) score += 20;
  else if (timing < 72) score += 10;

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
    positionSize: Math.floor(Math.random() * 10) + 5,
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
      const walletData: InsertWallet = {
        address: generateWalletAddress(),
        winRate: profile.winRate,
        totalBets: profile.bets,
        totalVolume: profile.volume,
        accountAgeDays: profile.ageDays,
        portfolioConcentration: profile.concentration,
        avgTimingProximity: profile.timing,
        isFlagged: true,
        notes: null,
        riskScore: 0,
      };

      const riskScore = calculateRiskScore(walletData);
      const wallet: Wallet = {
        id,
        ...walletData,
        riskScore,
        isFlagged: riskScore >= 40,
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
      ...insertWallet,
      riskScore,
      isFlagged: riskScore >= 40,
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
      ...insertMarket,
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
      ...insertTransaction,
      timestamp: insertTransaction.timestamp ?? new Date(),
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
}

export const storage = new MemStorage();
