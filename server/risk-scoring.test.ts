import { describe, it, expect } from "vitest";
import {
  calculateRiskScore,
  calculateRiskFactors,
  calculateAccountAgeScore,
  calculateWinRateScore,
  calculateConcentrationScore,
  calculateTimingScore,
  calculatePositionSizeScore,
  getRiskLevel,
  shouldFlagWallet,
  RISK_THRESHOLDS,
  FACTOR_CONFIG,
} from "./risk-scoring";
import type { Wallet } from "@shared/schema";

describe("Risk Scoring Module", () => {
  describe("calculateAccountAgeScore", () => {
    it("should return 20 points for accounts less than 7 days old", () => {
      expect(calculateAccountAgeScore(1)).toBe(20);
      expect(calculateAccountAgeScore(6)).toBe(20);
    });

    it("should return 15 points for accounts 7-13 days old", () => {
      expect(calculateAccountAgeScore(7)).toBe(15);
      expect(calculateAccountAgeScore(13)).toBe(15);
    });

    it("should return 8 points for accounts 14-29 days old", () => {
      expect(calculateAccountAgeScore(14)).toBe(8);
      expect(calculateAccountAgeScore(29)).toBe(8);
    });

    it("should return 0 points for accounts 30+ days old", () => {
      expect(calculateAccountAgeScore(30)).toBe(0);
      expect(calculateAccountAgeScore(100)).toBe(0);
    });
  });

  describe("calculateWinRateScore", () => {
    it("should return 20 points for win rates above 85%", () => {
      expect(calculateWinRateScore(0.86)).toBe(20);
      expect(calculateWinRateScore(0.95)).toBe(20);
      expect(calculateWinRateScore(1.0)).toBe(20);
    });

    it("should return 15 points for win rates 70-85%", () => {
      expect(calculateWinRateScore(0.71)).toBe(15);
      expect(calculateWinRateScore(0.85)).toBe(15);
    });

    it("should return 8 points for win rates 60-70%", () => {
      expect(calculateWinRateScore(0.61)).toBe(8);
      expect(calculateWinRateScore(0.70)).toBe(8);
    });

    it("should return 0 points for win rates 60% or below", () => {
      expect(calculateWinRateScore(0.60)).toBe(0);
      expect(calculateWinRateScore(0.50)).toBe(0);
      expect(calculateWinRateScore(0.0)).toBe(0);
    });
  });

  describe("calculateConcentrationScore", () => {
    it("should return 20 points for concentration above 80%", () => {
      expect(calculateConcentrationScore(0.81)).toBe(20);
      expect(calculateConcentrationScore(0.95)).toBe(20);
    });

    it("should return 15 points for concentration 60-80%", () => {
      expect(calculateConcentrationScore(0.61)).toBe(15);
      expect(calculateConcentrationScore(0.80)).toBe(15);
    });

    it("should return 8 points for concentration 40-60%", () => {
      expect(calculateConcentrationScore(0.41)).toBe(8);
      expect(calculateConcentrationScore(0.60)).toBe(8);
    });

    it("should return 0 points for concentration 40% or below", () => {
      expect(calculateConcentrationScore(0.40)).toBe(0);
      expect(calculateConcentrationScore(0.20)).toBe(0);
    });
  });

  describe("calculateTimingScore", () => {
    it("should return 20 points for timing less than 24 hours", () => {
      expect(calculateTimingScore(1)).toBe(20);
      expect(calculateTimingScore(23)).toBe(20);
    });

    it("should return 15 points for timing 24-47 hours", () => {
      expect(calculateTimingScore(24)).toBe(15);
      expect(calculateTimingScore(47)).toBe(15);
    });

    it("should return 8 points for timing 48-71 hours", () => {
      expect(calculateTimingScore(48)).toBe(8);
      expect(calculateTimingScore(71)).toBe(8);
    });

    it("should return 0 points for timing 72+ hours", () => {
      expect(calculateTimingScore(72)).toBe(0);
      expect(calculateTimingScore(168)).toBe(0);
    });
  });

  describe("calculatePositionSizeScore", () => {
    it("should return 20 points for volume $10,000+", () => {
      expect(calculatePositionSizeScore(10000)).toBe(20);
      expect(calculatePositionSizeScore(50000)).toBe(20);
    });

    it("should return 15 points for volume $2,500-$9,999", () => {
      expect(calculatePositionSizeScore(2500)).toBe(15);
      expect(calculatePositionSizeScore(9999)).toBe(15);
    });

    it("should return 8 points for volume $500-$2,499", () => {
      expect(calculatePositionSizeScore(500)).toBe(8);
      expect(calculatePositionSizeScore(2499)).toBe(8);
    });

    it("should return 0 points for volume under $500", () => {
      expect(calculatePositionSizeScore(499)).toBe(0);
      expect(calculatePositionSizeScore(0)).toBe(0);
    });
  });

  describe("calculateRiskScore", () => {
    it("should return maximum score (100) for highest risk wallet", () => {
      const score = calculateRiskScore({
        accountAgeDays: 1,
        winRate: 0.95,
        portfolioConcentration: 0.95,
        avgTimingProximity: 12,
        totalVolume: 100000,
      });
      expect(score).toBe(100);
    });

    it("should return minimum score (0) for lowest risk wallet", () => {
      const score = calculateRiskScore({
        accountAgeDays: 365,
        winRate: 0.50,
        portfolioConcentration: 0.30,
        avgTimingProximity: 168,
        totalVolume: 100,
      });
      expect(score).toBe(0);
    });

    it("should use default values when metrics are missing", () => {
      const score = calculateRiskScore({});
      // Default: ageDays=30 (0), winRate=0.5 (0), concentration=0.3 (0), timing=72 (0), volume=0 (0)
      expect(score).toBe(0);
    });

    it("should calculate correct score for medium risk wallet", () => {
      const score = calculateRiskScore({
        accountAgeDays: 10, // 15 points
        winRate: 0.75,      // 15 points
        portfolioConcentration: 0.50, // 8 points
        avgTimingProximity: 36, // 15 points
        totalVolume: 5000,  // 15 points
      });
      expect(score).toBe(68);
    });

    it("should cap score at 100", () => {
      // This shouldn't happen with current thresholds, but test the cap
      const score = calculateRiskScore({
        accountAgeDays: 1,
        winRate: 0.99,
        portfolioConcentration: 0.99,
        avgTimingProximity: 1,
        totalVolume: 1000000,
      });
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe("calculateRiskFactors", () => {
    it("should return individual factor scores for a wallet", () => {
      const wallet: Wallet = {
        id: "test-id",
        address: "0x123",
        riskScore: 68,
        winRate: 0.75,
        totalBets: 10,
        totalVolume: 5000,
        currentPositionValue: 1000,
        accountAgeDays: 10,
        portfolioConcentration: 0.50,
        avgTimingProximity: 36,
        isFlagged: true,
        notes: null,
      };

      const factors = calculateRiskFactors(wallet);

      expect(factors.accountAge).toBe(15);
      expect(factors.winRate).toBe(15);
      expect(factors.portfolioConcentration).toBe(8);
      expect(factors.timingProximity).toBe(15);
      expect(factors.positionSize).toBe(15);
    });

    it("should return all zeros for a low-risk wallet", () => {
      const wallet: Wallet = {
        id: "test-id",
        address: "0x123",
        riskScore: 0,
        winRate: 0.50,
        totalBets: 10,
        totalVolume: 100,
        currentPositionValue: 50,
        accountAgeDays: 365,
        portfolioConcentration: 0.20,
        avgTimingProximity: 168,
        isFlagged: false,
        notes: null,
      };

      const factors = calculateRiskFactors(wallet);

      expect(factors.accountAge).toBe(0);
      expect(factors.winRate).toBe(0);
      expect(factors.portfolioConcentration).toBe(0);
      expect(factors.timingProximity).toBe(0);
      expect(factors.positionSize).toBe(0);
    });
  });

  describe("getRiskLevel", () => {
    it("should return 'critical' for scores 80+", () => {
      expect(getRiskLevel(80)).toBe("critical");
      expect(getRiskLevel(100)).toBe("critical");
    });

    it("should return 'high' for scores 60-79", () => {
      expect(getRiskLevel(60)).toBe("high");
      expect(getRiskLevel(79)).toBe("high");
    });

    it("should return 'medium' for scores 40-59", () => {
      expect(getRiskLevel(40)).toBe("medium");
      expect(getRiskLevel(59)).toBe("medium");
    });

    it("should return 'low' for scores below 40", () => {
      expect(getRiskLevel(39)).toBe("low");
      expect(getRiskLevel(0)).toBe("low");
    });
  });

  describe("shouldFlagWallet", () => {
    it("should return true for scores at or above medium threshold", () => {
      expect(shouldFlagWallet(40)).toBe(true);
      expect(shouldFlagWallet(60)).toBe(true);
      expect(shouldFlagWallet(100)).toBe(true);
    });

    it("should return false for scores below medium threshold", () => {
      expect(shouldFlagWallet(39)).toBe(false);
      expect(shouldFlagWallet(0)).toBe(false);
    });
  });

  describe("RISK_THRESHOLDS", () => {
    it("should have correct threshold values", () => {
      expect(RISK_THRESHOLDS.LOW).toBe(0);
      expect(RISK_THRESHOLDS.MEDIUM).toBe(40);
      expect(RISK_THRESHOLDS.HIGH).toBe(60);
      expect(RISK_THRESHOLDS.CRITICAL).toBe(80);
    });
  });

  describe("FACTOR_CONFIG", () => {
    it("should have 5 factors with max 20 points each", () => {
      expect(FACTOR_CONFIG.accountAge.maxPoints).toBe(20);
      expect(FACTOR_CONFIG.winRate.maxPoints).toBe(20);
      expect(FACTOR_CONFIG.portfolioConcentration.maxPoints).toBe(20);
      expect(FACTOR_CONFIG.timingProximity.maxPoints).toBe(20);
      expect(FACTOR_CONFIG.positionSize.maxPoints).toBe(20);
    });

    it("should have descending thresholds with descending points", () => {
      // Account age: lower days = more points
      const ageThresholds = FACTOR_CONFIG.accountAge.thresholds;
      expect(ageThresholds[0].days).toBeLessThan(ageThresholds[1].days);
      expect(ageThresholds[0].points).toBeGreaterThan(ageThresholds[1].points);

      // Win rate: higher rate = more points
      const wrThresholds = FACTOR_CONFIG.winRate.thresholds;
      expect(wrThresholds[0].rate).toBeGreaterThan(wrThresholds[1].rate);
      expect(wrThresholds[0].points).toBeGreaterThan(wrThresholds[1].points);
    });
  });
});
