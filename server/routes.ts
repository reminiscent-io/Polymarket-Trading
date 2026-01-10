import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { DEFAULT_PAGINATION, type PaginationOptions } from "./storage-interface";

/**
 * Parse pagination query parameters from request
 */
function parsePagination(query: { limit?: string; offset?: string }): PaginationOptions {
  const limit = query.limit ? parseInt(query.limit, 10) : DEFAULT_PAGINATION.limit;
  const offset = query.offset ? parseInt(query.offset, 10) : DEFAULT_PAGINATION.offset;

  return {
    limit: Number.isNaN(limit) ? DEFAULT_PAGINATION.limit : Math.min(limit, DEFAULT_PAGINATION.maxLimit),
    offset: Number.isNaN(offset) ? DEFAULT_PAGINATION.offset : Math.max(0, offset),
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/wallets", async (req, res) => {
    try {
      const pagination = parsePagination(req.query as { limit?: string; offset?: string });
      const result = await storage.getWallets(pagination);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch wallets" });
    }
  });

  app.get("/api/wallets/flagged", async (req, res) => {
    try {
      const pagination = parsePagination(req.query as { limit?: string; offset?: string });
      const result = await storage.getFlaggedWallets(pagination);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch flagged wallets" });
    }
  });

  app.get("/api/wallets/historical", async (req, res) => {
    try {
      const pagination = parsePagination(req.query as { limit?: string; offset?: string });
      const result = await storage.getHistoricalWallets(pagination);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch historical wallets" });
    }
  });

  app.get("/api/wallets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const wallet = await storage.getWalletWithTransactions(id);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch wallet" });
    }
  });

  app.get("/api/wallets/:id/risk-factors", async (req, res) => {
    try {
      const { id } = req.params;
      const factors = await storage.getWalletRiskFactors(id);
      if (!factors) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      res.json(factors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch risk factors" });
    }
  });

  app.get("/api/markets", async (req, res) => {
    try {
      const pagination = parsePagination(req.query as { limit?: string; offset?: string });
      const result = await storage.getMarkets(pagination);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch markets" });
    }
  });

  app.get("/api/markets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const market = await storage.getMarket(id);
      if (!market) {
        return res.status(404).json({ error: "Market not found" });
      }
      res.json(market);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch market" });
    }
  });

  app.get("/api/transactions", async (_req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Earnings Insider Detection endpoints
  app.get("/api/earnings", async (_req, res) => {
    try {
      const alerts = await storage.getEarningsAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("[API] Failed to fetch earnings alerts:", error);
      res.status(500).json({ error: "Failed to fetch earnings data" });
    }
  });

  app.get("/api/earnings/stats", async (_req, res) => {
    try {
      const stats = await storage.getEarningsStats();
      res.json(stats);
    } catch (error) {
      console.error("[API] Failed to fetch earnings stats:", error);
      res.status(500).json({ error: "Failed to fetch earnings stats" });
    }
  });

  // Portfolio tracking endpoints (Authenticated)
  app.get("/api/portfolio", async (_req, res) => {
    try {
      if (!storage.isPortfolioAvailable()) {
        return res.status(503).json({
          error: "Portfolio tracking not available",
          message: "Configure POLYMARKET_API_KEY, POLYMARKET_API_SECRET, and POLYMARKET_WALLET_ADDRESS in Replit Secrets to enable portfolio tracking."
        });
      }

      const portfolio = await storage.getUserPortfolio();
      res.json(portfolio);
    } catch (error) {
      console.error("[API] Failed to fetch portfolio:", error);
      res.status(500).json({
        error: "Failed to fetch portfolio",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/portfolio/stats", async (_req, res) => {
    try {
      if (!storage.isPortfolioAvailable()) {
        return res.status(503).json({
          error: "Portfolio tracking not available",
          message: "Configure POLYMARKET_API_KEY, POLYMARKET_API_SECRET, and POLYMARKET_WALLET_ADDRESS in Replit Secrets to enable portfolio tracking."
        });
      }

      const stats = await storage.getPortfolioStats();
      res.json(stats);
    } catch (error) {
      console.error("[API] Failed to fetch portfolio stats:", error);
      res.status(500).json({
        error: "Failed to fetch portfolio stats",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/portfolio/available", async (_req, res) => {
    try {
      const available = storage.isPortfolioAvailable();
      res.json({ available });
    } catch (error) {
      console.error("[API] Failed to check portfolio availability:", error);
      res.status(500).json({ error: "Failed to check portfolio availability" });
    }
  });

  return httpServer;
}
