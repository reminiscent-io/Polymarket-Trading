import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "http";
import request from "supertest";

// Set mock data mode before any imports
vi.stubEnv("MOCK_DATA", "true");

describe("API Routes", () => {
  let app: express.Express;
  let httpServer: Server;

  beforeAll(async () => {
    // Dynamically import routes after setting env
    const { registerRoutes } = await import("./routes");

    app = express();
    app.use(express.json());
    httpServer = createServer(app);
    await registerRoutes(httpServer, app);

    // Wait for any async initialization
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    httpServer.close();
    vi.unstubAllEnvs();
  });

  describe("GET /api/stats", () => {
    it("should return dashboard stats", async () => {
      const response = await request(app).get("/api/stats");

      // Debug: log the response if it fails
      if (response.status !== 200) {
        console.log("Stats response:", response.status, response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("totalFlaggedToday");
      expect(response.body).toHaveProperty("highRiskCount");
      expect(response.body).toHaveProperty("activeMarketsMonitored");
      expect(response.body).toHaveProperty("detectionAccuracy");
      expect(typeof response.body.totalFlaggedToday).toBe("number");
    });
  });

  describe("GET /api/wallets", () => {
    it("should return paginated wallets", async () => {
      const response = await request(app).get("/api/wallets");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("total");
      expect(response.body).toHaveProperty("limit");
      expect(response.body).toHaveProperty("offset");
      expect(response.body).toHaveProperty("hasMore");
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const response = await request(app).get("/api/wallets?limit=5");

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(5);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it("should respect offset parameter", async () => {
      const response = await request(app).get("/api/wallets?offset=5");

      expect(response.status).toBe(200);
      expect(response.body.offset).toBe(5);
    });

    it("should cap limit at max value", async () => {
      const response = await request(app).get("/api/wallets?limit=500");

      expect(response.status).toBe(200);
      expect(response.body.limit).toBeLessThanOrEqual(200);
    });

    it("should handle invalid pagination parameters gracefully", async () => {
      const response = await request(app).get("/api/wallets?limit=abc&offset=-5");

      expect(response.status).toBe(200);
      // Should use defaults for invalid values
      expect(response.body.limit).toBeGreaterThan(0);
      expect(response.body.offset).toBeGreaterThanOrEqual(0);
    });
  });

  describe("GET /api/wallets/flagged", () => {
    it("should return paginated flagged wallets", async () => {
      const response = await request(app).get("/api/wallets/flagged");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(Array.isArray(response.body.data)).toBe(true);

      // All returned wallets should be flagged
      for (const wallet of response.body.data) {
        expect(wallet.isFlagged).toBe(true);
        expect(wallet.riskScore).toBeGreaterThanOrEqual(40);
      }
    });

    it("should sort by risk score descending", async () => {
      const response = await request(app).get("/api/wallets/flagged");

      expect(response.status).toBe(200);
      const wallets = response.body.data;

      for (let i = 1; i < wallets.length; i++) {
        expect(wallets[i - 1].riskScore).toBeGreaterThanOrEqual(wallets[i].riskScore);
      }
    });
  });

  describe("GET /api/wallets/historical", () => {
    it("should return paginated historical wallets with high win rates", async () => {
      const response = await request(app).get("/api/wallets/historical");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(Array.isArray(response.body.data)).toBe(true);

      // All returned wallets should have high win rates
      for (const wallet of response.body.data) {
        expect(wallet.winRate).toBeGreaterThan(0.7);
      }
    });
  });

  describe("GET /api/wallets/:id", () => {
    it("should return 404 for non-existent wallet", async () => {
      const response = await request(app).get("/api/wallets/non-existent-id");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/wallets/:id/risk-factors", () => {
    it("should return 404 for non-existent wallet", async () => {
      const response = await request(app).get("/api/wallets/non-existent-id/risk-factors");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/markets", () => {
    it("should return paginated markets", async () => {
      const response = await request(app).get("/api/markets");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("total");
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should respect pagination parameters", async () => {
      const response = await request(app).get("/api/markets?limit=3&offset=2");

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(3);
      expect(response.body.offset).toBe(2);
    });

    it("should include market properties", async () => {
      const response = await request(app).get("/api/markets");

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        const market = response.body.data[0];
        expect(market).toHaveProperty("id");
        expect(market).toHaveProperty("name");
        expect(market).toHaveProperty("category");
        expect(market).toHaveProperty("totalVolume");
        expect(market).toHaveProperty("suspiciousWalletCount");
      }
    });

    it("should sort by suspicious wallet count descending", async () => {
      const response = await request(app).get("/api/markets");

      expect(response.status).toBe(200);
      const markets = response.body.data;

      for (let i = 1; i < markets.length; i++) {
        expect(markets[i - 1].suspiciousWalletCount).toBeGreaterThanOrEqual(
          markets[i].suspiciousWalletCount
        );
      }
    });
  });

  describe("GET /api/markets/:id", () => {
    it("should return 404 for non-existent market", async () => {
      const response = await request(app).get("/api/markets/non-existent-id");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/transactions", () => {
    it("should return transactions", async () => {
      const response = await request(app).get("/api/transactions");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should include transaction properties", async () => {
      const response = await request(app).get("/api/transactions");

      expect(response.status).toBe(200);
      if (response.body.length > 0) {
        const tx = response.body[0];
        expect(tx).toHaveProperty("id");
        expect(tx).toHaveProperty("walletId");
        expect(tx).toHaveProperty("marketId");
        expect(tx).toHaveProperty("amount");
        expect(tx).toHaveProperty("direction");
        expect(tx).toHaveProperty("timestamp");
      }
    });
  });

  describe("GET /api/earnings", () => {
    it("should return earnings alerts", async () => {
      const response = await request(app).get("/api/earnings");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should include earnings alert properties", async () => {
      const response = await request(app).get("/api/earnings");

      expect(response.status).toBe(200);
      if (response.body.length > 0) {
        const alert = response.body[0];
        expect(alert).toHaveProperty("id");
        expect(alert).toHaveProperty("symbol");
        expect(alert).toHaveProperty("companyName");
        expect(alert).toHaveProperty("earningsDate");
        expect(alert).toHaveProperty("insiderRiskScore");
        expect(alert).toHaveProperty("riskFactors");
      }
    });

    it("should sort by insider risk score descending", async () => {
      const response = await request(app).get("/api/earnings");

      expect(response.status).toBe(200);
      const alerts = response.body;

      for (let i = 1; i < alerts.length; i++) {
        expect(alerts[i - 1].insiderRiskScore).toBeGreaterThanOrEqual(
          alerts[i].insiderRiskScore
        );
      }
    });
  });

  describe("GET /api/earnings/stats", () => {
    it("should return earnings stats", async () => {
      const response = await request(app).get("/api/earnings/stats");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("totalEarningsTracked");
      expect(response.body).toHaveProperty("matchedMarketsCount");
      expect(response.body).toHaveProperty("highRiskAlertsCount");
      expect(response.body).toHaveProperty("avgDivergence");
    });
  });

  describe("Pagination Integration", () => {
    it("should correctly indicate hasMore when there are more results", async () => {
      const responseAll = await request(app).get("/api/wallets?limit=100");
      const total = responseAll.body.total;

      if (total > 5) {
        const responseLimited = await request(app).get("/api/wallets?limit=5");
        expect(responseLimited.body.hasMore).toBe(true);
      }
    });

    it("should correctly indicate hasMore=false when at end", async () => {
      const responseAll = await request(app).get("/api/wallets?limit=100");
      const total = responseAll.body.total;

      const response = await request(app).get(`/api/wallets?limit=${total}&offset=0`);
      expect(response.body.hasMore).toBe(false);
    });
  });
});
