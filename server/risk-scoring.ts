/**
 * Risk Scoring Module
 * Centralized risk calculation logic used by all storage implementations
 */

import type { Wallet, RiskFactors } from "@shared/schema";

// Risk score thresholds
export const RISK_THRESHOLDS = {
  LOW: 0,
  MEDIUM: 40,
  HIGH: 60,
  CRITICAL: 80,
} as const;

// Factor thresholds and points
export const FACTOR_CONFIG = {
  accountAge: {
    maxPoints: 20,
    thresholds: [
      { days: 7, points: 20 },
      { days: 14, points: 15 },
      { days: 30, points: 8 },
    ],
  },
  winRate: {
    maxPoints: 20,
    thresholds: [
      { rate: 0.85, points: 20 },
      { rate: 0.7, points: 15 },
      { rate: 0.6, points: 8 },
    ],
  },
  portfolioConcentration: {
    maxPoints: 20,
    thresholds: [
      { concentration: 0.8, points: 20 },
      { concentration: 0.6, points: 15 },
      { concentration: 0.4, points: 8 },
    ],
  },
  timingProximity: {
    maxPoints: 20,
    thresholds: [
      { hours: 24, points: 20 },
      { hours: 48, points: 15 },
      { hours: 72, points: 8 },
    ],
  },
  positionSize: {
    maxPoints: 20,
    thresholds: [
      { volume: 10000, points: 20 },
      { volume: 2500, points: 15 },
      { volume: 500, points: 8 },
    ],
  },
} as const;

export interface WalletMetrics {
  accountAgeDays: number;
  winRate: number;
  portfolioConcentration: number;
  avgTimingProximity: number;
  totalVolume: number;
}

/**
 * Calculate account age risk score (0-20 points)
 * Newer accounts are more suspicious
 */
export function calculateAccountAgeScore(ageDays: number): number {
  for (const threshold of FACTOR_CONFIG.accountAge.thresholds) {
    if (ageDays < threshold.days) {
      return threshold.points;
    }
  }
  return 0;
}

/**
 * Calculate win rate risk score (0-20 points)
 * Higher win rates are more suspicious
 */
export function calculateWinRateScore(winRate: number): number {
  for (const threshold of FACTOR_CONFIG.winRate.thresholds) {
    if (winRate > threshold.rate) {
      return threshold.points;
    }
  }
  return 0;
}

/**
 * Calculate portfolio concentration risk score (0-20 points)
 * Higher concentration in single markets is more suspicious
 */
export function calculateConcentrationScore(concentration: number): number {
  for (const threshold of FACTOR_CONFIG.portfolioConcentration.thresholds) {
    if (concentration > threshold.concentration) {
      return threshold.points;
    }
  }
  return 0;
}

/**
 * Calculate timing proximity risk score (0-20 points)
 * Trading closer to resolution is more suspicious
 */
export function calculateTimingScore(avgHours: number): number {
  for (const threshold of FACTOR_CONFIG.timingProximity.thresholds) {
    if (avgHours < threshold.hours) {
      return threshold.points;
    }
  }
  return 0;
}

/**
 * Calculate position size risk score (0-20 points)
 * Larger positions are more suspicious
 */
export function calculatePositionSizeScore(volume: number): number {
  for (const threshold of FACTOR_CONFIG.positionSize.thresholds) {
    if (volume >= threshold.volume) {
      return threshold.points;
    }
  }
  return 0;
}

/**
 * Calculate overall risk score (0-100)
 * Based on five factors: account age, win rate, portfolio concentration,
 * timing proximity, and position size
 */
export function calculateRiskScore(metrics: Partial<WalletMetrics>): number {
  const ageDays = metrics.accountAgeDays ?? 30;
  const winRate = metrics.winRate ?? 0.5;
  const concentration = metrics.portfolioConcentration ?? 0.3;
  const timing = metrics.avgTimingProximity ?? 72;
  const volume = metrics.totalVolume ?? 0;

  const score =
    calculateAccountAgeScore(ageDays) +
    calculateWinRateScore(winRate) +
    calculateConcentrationScore(concentration) +
    calculateTimingScore(timing) +
    calculatePositionSizeScore(volume);

  return Math.min(100, score);
}

/**
 * Calculate individual risk factor scores for a wallet
 * Returns breakdown of each factor's contribution to the total score
 */
export function calculateRiskFactors(wallet: Wallet): RiskFactors {
  return {
    accountAge: calculateAccountAgeScore(wallet.accountAgeDays),
    winRate: calculateWinRateScore(wallet.winRate),
    portfolioConcentration: calculateConcentrationScore(wallet.portfolioConcentration),
    timingProximity: calculateTimingScore(wallet.avgTimingProximity),
    positionSize: calculatePositionSizeScore(wallet.totalVolume),
  };
}

/**
 * Determine risk level based on score
 */
export function getRiskLevel(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= RISK_THRESHOLDS.CRITICAL) return "critical";
  if (score >= RISK_THRESHOLDS.HIGH) return "high";
  if (score >= RISK_THRESHOLDS.MEDIUM) return "medium";
  return "low";
}

/**
 * Check if a wallet should be flagged based on risk score
 */
export function shouldFlagWallet(riskScore: number): boolean {
  return riskScore >= RISK_THRESHOLDS.MEDIUM;
}
