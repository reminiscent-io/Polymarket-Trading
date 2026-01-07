import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

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

  app.get("/api/wallets", async (_req, res) => {
    try {
      const wallets = await storage.getWallets();
      res.json(wallets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch wallets" });
    }
  });

  app.get("/api/wallets/flagged", async (_req, res) => {
    try {
      const wallets = await storage.getFlaggedWallets();
      res.json(wallets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch flagged wallets" });
    }
  });

  app.get("/api/wallets/historical", async (_req, res) => {
    try {
      const wallets = await storage.getHistoricalWallets();
      res.json(wallets);
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

  app.get("/api/markets", async (_req, res) => {
    try {
      const markets = await storage.getMarkets();
      res.json(markets);
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

  return httpServer;
}
