import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  address: text("address").notNull().unique(),
  riskScore: integer("risk_score").notNull().default(0),
  winRate: real("win_rate").notNull().default(0),
  totalBets: integer("total_bets").notNull().default(0),
  totalVolume: real("total_volume").notNull().default(0),
  currentPositionValue: real("current_position_value").notNull().default(0),
  accountAgeDays: integer("account_age_days").notNull().default(0),
  portfolioConcentration: real("portfolio_concentration").notNull().default(0),
  avgTimingProximity: integer("avg_timing_proximity").notNull().default(72),
  isFlagged: boolean("is_flagged").notNull().default(false),
  notes: text("notes"),
}, (table) => ({
  addressIdx: index("idx_wallets_address").on(table.address),
  riskScoreIdx: index("idx_wallets_risk_score").on(table.riskScore),
}));

export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true });
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof wallets.$inferSelect;

export const markets = pgTable("markets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conditionId: text("condition_id").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  resolutionTime: timestamp("resolution_time"),
  suspiciousWalletCount: integer("suspicious_wallet_count").notNull().default(0),
  avgRiskScore: real("avg_risk_score").notNull().default(0),
  totalVolume: real("total_volume").notNull().default(0),
  isResolved: boolean("is_resolved").notNull().default(false),
}, (table) => ({
  conditionIdIdx: index("idx_markets_condition_id").on(table.conditionId),
}));

export const insertMarketSchema = createInsertSchema(markets).omit({ id: true });
export type InsertMarket = z.infer<typeof insertMarketSchema>;
export type Market = typeof markets.$inferSelect;

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull()
    .references(() => wallets.id, { onDelete: 'cascade' }),
  marketId: varchar("market_id").notNull()
    .references(() => markets.id, { onDelete: 'cascade' }),
  marketTitle: text("market_title"),
  amount: real("amount").notNull(),
  direction: text("direction").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  hoursBeforeResolution: integer("hours_before_resolution"),
  won: boolean("won"),
  priceImpact: real("price_impact").default(0),
}, (table) => ({
  walletIdx: index("idx_transactions_wallet").on(table.walletId),
  marketIdx: index("idx_transactions_market").on(table.marketId),
  timestampIdx: index("idx_transactions_timestamp").on(table.timestamp),
}));

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export interface DashboardStats {
  totalFlaggedToday: number;
  highRiskCount: number;
  activeMarketsMonitored: number;
  detectionAccuracy: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface WalletWithTransactions extends Wallet {
  transactions: Transaction[];
  markets: Market[];
}

export interface RiskFactors {
  accountAge: number;
  winRate: number;
  portfolioConcentration: number;
  timingProximity: number;
  positionSize: number;
}

// Earnings Insider Detection types
export interface EarningsEvent {
  symbol: string;
  companyName: string;
  earningsDate: string;
  earningsTime: "bmo" | "amc" | "unknown";
  estimatedEps: number | null;
  actualEps: number | null;
  beatProbability: number | null;
  revenue: number | null;
}

export interface EarningsRiskFactors {
  divergenceScore: number;
  whaleActivityScore: number;
  timingUrgencyScore: number;
  volumeAnomalyScore: number;
}

export interface EarningsInsiderAlert {
  id: string;
  symbol: string;
  companyName: string;
  earningsDate: string;
  daysUntilEarnings: number;
  insiderRiskScore: number;
  polymarketOdds: number;
  analystConsensus: number | null;
  divergence: number;
  suspiciousWhaleCount: number;
  volumeRatio: number;
  matchedMarketId: string | null;
  matchedMarketQuestion: string | null;
  riskFactors: EarningsRiskFactors;
}

export interface EarningsStats {
  totalEarningsTracked: number;
  matchedMarketsCount: number;
  highRiskAlertsCount: number;
  avgDivergence: number;
}
