/**
 * Storage Interface
 * Defines the contract for all storage implementations
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
} from "@shared/schema";

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

  // Earnings Insider Detection
  getEarningsAlerts(): Promise<EarningsInsiderAlert[]>;
  getEarningsStats(): Promise<EarningsStats>;
}
