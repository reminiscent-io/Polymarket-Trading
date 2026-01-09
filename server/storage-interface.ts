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

/**
 * Pagination options for list endpoints
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGINATION = {
  limit: 50,
  offset: 0,
  maxLimit: 200,
} as const;

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getWallets(options?: PaginationOptions): Promise<PaginatedResult<Wallet>>;
  getFlaggedWallets(options?: PaginationOptions): Promise<PaginatedResult<Wallet>>;
  getHistoricalWallets(options?: PaginationOptions): Promise<PaginatedResult<Wallet>>;
  getWallet(id: string): Promise<Wallet | undefined>;
  getWalletWithTransactions(id: string): Promise<WalletWithTransactions | undefined>;
  getWalletRiskFactors(id: string): Promise<RiskFactors | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;

  getMarkets(options?: PaginationOptions): Promise<PaginatedResult<Market>>;
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
