/**
 * Financial Modeling Prep API Client
 * Fetches earnings calendar and analyst consensus data
 *
 * API Docs: https://site.financialmodelingprep.com/developer/docs
 * Free tier: 250 requests/day
 */

import type { EarningsEvent } from "@shared/schema";

interface FMPEarningsCalendar {
  date: string;
  symbol: string;
  eps: number | null;
  epsEstimated: number | null;
  time: string;
  revenue: number | null;
  revenueEstimated: number | null;
  fiscalDateEnding: string;
  updatedFromDate: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache TTL

// Company name mapping for S&P 500 companies
const COMPANY_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  GOOGL: "Alphabet Inc.",
  AMZN: "Amazon.com Inc.",
  NVDA: "NVIDIA Corporation",
  META: "Meta Platforms Inc.",
  TSLA: "Tesla Inc.",
  "BRK.B": "Berkshire Hathaway Inc.",
  UNH: "UnitedHealth Group Inc.",
  JNJ: "Johnson & Johnson",
  V: "Visa Inc.",
  XOM: "Exxon Mobil Corporation",
  JPM: "JPMorgan Chase & Co.",
  PG: "Procter & Gamble Co.",
  MA: "Mastercard Inc.",
  HD: "Home Depot Inc.",
  CVX: "Chevron Corporation",
  MRK: "Merck & Co. Inc.",
  ABBV: "AbbVie Inc.",
  PEP: "PepsiCo Inc.",
  KO: "Coca-Cola Co.",
  COST: "Costco Wholesale Corp.",
  AVGO: "Broadcom Inc.",
  LLY: "Eli Lilly and Co.",
  WMT: "Walmart Inc.",
  MCD: "McDonald's Corp.",
  CSCO: "Cisco Systems Inc.",
  ACN: "Accenture plc",
  DHR: "Danaher Corporation",
  ABT: "Abbott Laboratories",
  NEE: "NextEra Energy Inc.",
  VZ: "Verizon Communications Inc.",
  ADBE: "Adobe Inc.",
  CRM: "Salesforce Inc.",
  TXN: "Texas Instruments Inc.",
  CMCSA: "Comcast Corporation",
  PM: "Philip Morris International",
  NKE: "Nike Inc.",
  TMO: "Thermo Fisher Scientific",
  NFLX: "Netflix Inc.",
  AMD: "Advanced Micro Devices",
  INTC: "Intel Corporation",
  QCOM: "Qualcomm Inc.",
  HON: "Honeywell International",
  UPS: "United Parcel Service",
  BA: "Boeing Co.",
  CAT: "Caterpillar Inc.",
  GS: "Goldman Sachs Group",
  LOW: "Lowe's Companies Inc.",
  SBUX: "Starbucks Corporation",
};

class EarningsClient {
  private readonly API_BASE = "https://financialmodelingprep.com/api/v3";
  private apiKey: string;
  private earningsCache: CacheEntry<EarningsEvent[]> | null = null;
  private sp500Cache: CacheEntry<string[]> | null = null;
  private requestsToday: number = 0;
  private lastRequestDate: string = "";

  constructor() {
    this.apiKey = process.env.FMP_API_KEY || "";
    if (!this.apiKey) {
      console.warn("[Earnings] FMP_API_KEY not set - earnings features will use mock data");
    }
  }

  private resetDailyCounterIfNeeded(): void {
    const today = new Date().toISOString().split("T")[0];
    if (today !== this.lastRequestDate) {
      this.requestsToday = 0;
      this.lastRequestDate = today;
    }
  }

  private canMakeRequest(): boolean {
    this.resetDailyCounterIfNeeded();
    return this.requestsToday < 240; // Leave buffer for 250/day limit
  }

  private isCacheValid<T>(cache: CacheEntry<T> | null): boolean {
    if (!cache) return false;
    return Date.now() - cache.timestamp < CACHE_TTL;
  }

  /**
   * Fetch S&P 500 earnings calendar for next N days
   */
  async getEarningsCalendar(daysAhead: number = 30): Promise<EarningsEvent[]> {
    if (!this.apiKey) {
      console.log("[Earnings] No API key, returning mock earnings calendar");
      return this.getMockEarningsCalendar();
    }

    if (this.isCacheValid(this.earningsCache)) {
      console.log("[Earnings] Returning cached earnings calendar");
      return this.earningsCache!.data;
    }

    if (!this.canMakeRequest()) {
      console.warn("[Earnings] Daily API limit reached");
      return this.earningsCache?.data ?? this.getMockEarningsCalendar();
    }

    const fromDate = new Date().toISOString().split("T")[0];
    const toDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const url = `${this.API_BASE}/earning_calendar?from=${fromDate}&to=${toDate}&apikey=${this.apiKey}`;

    console.log(`[Earnings] Fetching earnings calendar: ${fromDate} to ${toDate}`);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        if (response.status === 403) {
          console.warn("[Earnings] FMP API 403 Forbidden - Likely subscription level or invalid key. Falling back to mock data.");
          return this.earningsCache?.data ?? this.getMockEarningsCalendar();
        }
        throw new Error(`FMP API error: ${response.status}`);
      }

      this.requestsToday++;
      const data = (await response.json()) as FMPEarningsCalendar[];

      // Filter to S&P 500 companies and convert to internal format
      const sp500Symbols = await this.getSP500Symbols();
      const sp500Set = new Set(sp500Symbols);

      const events: EarningsEvent[] = data
        .filter((item) => sp500Set.has(item.symbol))
        .map((item) => ({
          symbol: item.symbol,
          companyName: COMPANY_NAMES[item.symbol] || item.symbol,
          earningsDate: item.date,
          earningsTime: this.parseEarningsTime(item.time),
          estimatedEps: item.epsEstimated,
          actualEps: item.eps,
          beatProbability: this.estimateBeatProbability(item),
          revenue: item.revenueEstimated,
        }));

      this.earningsCache = {
        data: events,
        timestamp: Date.now(),
      };

      console.log(`[Earnings] Fetched ${events.length} S&P 500 earnings events`);
      return events;
    } catch (error) {
      console.error("[Earnings] Failed to fetch calendar:", error);
      return this.earningsCache?.data ?? this.getMockEarningsCalendar();
    }
  }

  private parseEarningsTime(time: string): "bmo" | "amc" | "unknown" {
    const lower = (time || "").toLowerCase();
    if (lower.includes("bmo") || lower.includes("before")) return "bmo";
    if (lower.includes("amc") || lower.includes("after")) return "amc";
    return "unknown";
  }

  /**
   * Estimate beat probability based on historical patterns
   * In production, this would use historical beat rates per company
   */
  private estimateBeatProbability(item: FMPEarningsCalendar): number | null {
    // Default beat probability based on historical S&P 500 average (~75%)
    // In a real implementation, this would be fetched from historical data
    return 0.75;
  }

  /**
   * Get S&P 500 company list for filtering
   */
  async getSP500Symbols(): Promise<string[]> {
    if (this.isCacheValid(this.sp500Cache)) {
      return this.sp500Cache!.data;
    }

    // Return hardcoded subset as fallback (most active/relevant for prediction markets)
    const fallbackSymbols = [
      "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B",
      "UNH", "JNJ", "V", "XOM", "JPM", "PG", "MA", "HD", "CVX", "MRK",
      "ABBV", "PEP", "KO", "COST", "AVGO", "LLY", "WMT", "MCD", "CSCO",
      "ACN", "DHR", "ABT", "NEE", "VZ", "ADBE", "CRM", "TXN", "CMCSA",
      "PM", "NKE", "TMO", "NFLX", "AMD", "INTC", "QCOM", "HON", "UPS",
      "BA", "CAT", "GS", "LOW", "SBUX",
    ];

    if (!this.apiKey || !this.canMakeRequest()) {
      this.sp500Cache = { data: fallbackSymbols, timestamp: Date.now() };
      return fallbackSymbols;
    }

    const url = `${this.API_BASE}/sp500_constituent?apikey=${this.apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch S&P 500");

      this.requestsToday++;
      const data = (await response.json()) as { symbol: string }[];
      const symbols = data.map((d) => d.symbol);

      this.sp500Cache = { data: symbols, timestamp: Date.now() };
      return symbols;
    } catch (error) {
      console.error("[Earnings] Failed to fetch S&P 500 list:", error);
      this.sp500Cache = { data: fallbackSymbols, timestamp: Date.now() };
      return fallbackSymbols;
    }
  }

  /**
   * Generate mock earnings calendar for development/testing
   */
  private getMockEarningsCalendar(): EarningsEvent[] {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    return [
      {
        symbol: "AAPL",
        companyName: "Apple Inc.",
        earningsDate: new Date(now + 5 * day).toISOString().split("T")[0],
        earningsTime: "amc",
        estimatedEps: 2.35,
        actualEps: null,
        beatProbability: 0.72,
        revenue: 94500000000,
      },
      {
        symbol: "MSFT",
        companyName: "Microsoft Corporation",
        earningsDate: new Date(now + 3 * day).toISOString().split("T")[0],
        earningsTime: "amc",
        estimatedEps: 3.12,
        actualEps: null,
        beatProbability: 0.78,
        revenue: 62000000000,
      },
      {
        symbol: "GOOGL",
        companyName: "Alphabet Inc.",
        earningsDate: new Date(now + 7 * day).toISOString().split("T")[0],
        earningsTime: "amc",
        estimatedEps: 1.85,
        actualEps: null,
        beatProbability: 0.68,
        revenue: 85000000000,
      },
      {
        symbol: "AMZN",
        companyName: "Amazon.com Inc.",
        earningsDate: new Date(now + 10 * day).toISOString().split("T")[0],
        earningsTime: "amc",
        estimatedEps: 1.15,
        actualEps: null,
        beatProbability: 0.65,
        revenue: 155000000000,
      },
      {
        symbol: "NVDA",
        companyName: "NVIDIA Corporation",
        earningsDate: new Date(now + 12 * day).toISOString().split("T")[0],
        earningsTime: "amc",
        estimatedEps: 5.65,
        actualEps: null,
        beatProbability: 0.82,
        revenue: 28000000000,
      },
      {
        symbol: "META",
        companyName: "Meta Platforms Inc.",
        earningsDate: new Date(now + 8 * day).toISOString().split("T")[0],
        earningsTime: "amc",
        estimatedEps: 5.25,
        actualEps: null,
        beatProbability: 0.70,
        revenue: 40000000000,
      },
      {
        symbol: "TSLA",
        companyName: "Tesla Inc.",
        earningsDate: new Date(now + 2 * day).toISOString().split("T")[0],
        earningsTime: "amc",
        estimatedEps: 0.75,
        actualEps: null,
        beatProbability: 0.55,
        revenue: 25000000000,
      },
      {
        symbol: "NFLX",
        companyName: "Netflix Inc.",
        earningsDate: new Date(now + 15 * day).toISOString().split("T")[0],
        earningsTime: "amc",
        estimatedEps: 4.50,
        actualEps: null,
        beatProbability: 0.62,
        revenue: 9500000000,
      },
      {
        symbol: "JPM",
        companyName: "JPMorgan Chase & Co.",
        earningsDate: new Date(now + 6 * day).toISOString().split("T")[0],
        earningsTime: "bmo",
        estimatedEps: 4.15,
        actualEps: null,
        beatProbability: 0.80,
        revenue: 42000000000,
      },
      {
        symbol: "AMD",
        companyName: "Advanced Micro Devices",
        earningsDate: new Date(now + 20 * day).toISOString().split("T")[0],
        earningsTime: "amc",
        estimatedEps: 0.92,
        actualEps: null,
        beatProbability: 0.58,
        revenue: 6500000000,
      },
    ];
  }

  clearCache(): void {
    this.earningsCache = null;
    this.sp500Cache = null;
    console.log("[Earnings] Cache cleared");
  }
}

export const earningsClient = new EarningsClient();
