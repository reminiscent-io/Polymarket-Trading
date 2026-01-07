# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Polymarket Insider Trading Detection Dashboard** - A real-time analytics dashboard that monitors Polymarket prediction markets for suspicious trading activity. Connects to live blockchain data via Polymarket's public APIs to identify potential insider trading patterns.

## Commands

### Development
```bash
npm run dev          # Start development server (port 5000)
npm run check        # TypeScript type checking
npm run build        # Production build
npm start            # Run production build
```

### Database
```bash
npm run db:push      # Push schema changes to PostgreSQL (requires DATABASE_URL)
```

Note: Database is configured but currently unused - the app uses in-memory storage with live Polymarket API data.

## Architecture

### Monorepo Structure

This is a **fullstack TypeScript monorepo** with three main directories:

```
client/       # React frontend (Vite)
server/       # Express backend
shared/       # Shared types/schemas (Drizzle ORM + Zod)
```

**Import paths:**
- Client code: `@/...` maps to `client/src/`
- Shared code: `@shared/...` maps to `shared/`
- Server code: Relative imports

### Data Flow Architecture

**Live Data Mode (Default):**
1. `server/storage.ts` exports storage singleton
2. Uses `PolymarketStorage` class from `server/polymarket-storage.ts`
3. Fetches data from Polymarket APIs via `server/polymarket-client.ts`
4. Analyzes 200+ real wallets from blockchain trades
5. 5-minute TTL cache prevents API rate limiting

**Mock Data Mode:**
- Set `MOCK_DATA=true` environment variable
- Uses `MemStorage` class with 20 hardcoded sample wallets

**Storage Interface:**
- Both implementations conform to `IStorage` interface in `server/storage-interface.ts`
- API routes in `server/routes.ts` are storage-agnostic

### Frontend Architecture

**Stack:**
- React 18 + TypeScript
- Wouter (lightweight router)
- TanStack Query (data fetching/caching)
- Shadcn/ui (Radix UI + Tailwind components)
- Vite (build tool)

**Key Patterns:**
- Query keys map directly to API paths: `["/api/stats"]`, `["/api/wallets"]`
- Custom `queryClient.getQueryFn()` in `client/src/lib/queryClient.ts` handles fetch logic
- No manual refetch intervals - data is considered fresh indefinitely (`staleTime: Infinity`)
- Theme support: Light/dark mode with system preference detection

**Pages (all in `client/src/pages/`):**
- `/` - Dashboard with metric cards and recent flagged wallets
- `/wallets` - Filterable list of all flagged wallets
- `/wallets/:id` - Wallet detail with risk breakdown and transaction history
- `/markets` - Markets view with suspicious activity metrics
- `/historical` - Leaderboard of high win-rate wallets
- `/earnings` - Earnings insider detector for corporate earnings announcements
- `/settings` - Risk threshold configuration (UI only, not persisted)

### Backend Architecture

**API Design:**
- RESTful endpoints under `/api/*`
- All routes use storage singleton via dependency injection
- Consistent error handling with 500 status + error message
- Request/response logging for `/api/*` routes only

**Risk Scoring Algorithm:**
Five-factor system (0-100 total):
1. Account Age (0-20 pts): <7 days = 20, <14 days = 15, <30 days = 8
2. Win Rate (0-20 pts): >85% = 20, >70% = 15, >60% = 8
3. Portfolio Concentration (0-20 pts): >80% = 20, >60% = 15, >40% = 8
4. Timing Proximity (0-20 pts): <24h = 20, <48h = 15, <72h = 8
5. Position Size (0-20 pts): ≥$10k = 20, ≥$2.5k = 15, ≥$500 = 8, <$500 = 0

Risk Levels: Critical (80+), High (60-79), Medium (40-59), Low (0-39)

### Polymarket Integration

**Data Sources:**
- Gamma API: `https://gamma-api.polymarket.com/markets` (markets + volumes)
- Data API: `https://data-api.polymarket.com/trades` (trades + wallet activity)

**Data Refresh:**
- Automatic refresh every 5 minutes on API calls
- Prevents concurrent refreshes with `isRefreshing` flag
- Falls back to stale cached data on API errors

**Wallet Analysis:**
- Groups trades by wallet address from recent trades endpoint
- Estimates account age from first observed trade timestamp
- Calculates portfolio concentration across markets
- Win rate estimated from buy/sell price patterns (heuristic)

### Earnings Insider Detection

**Data Sources:**
- Financial Modeling Prep API: Earnings calendar + analyst consensus (requires `FMP_API_KEY`)
- Falls back to mock data if API key not configured

**Earnings Risk Scoring Algorithm:**
Four-factor system (0-100 total):
1. Divergence (0-40 pts): PM odds vs analyst consensus - ≥30%=40, ≥20%=30, ≥15%=20, ≥10%=10
2. Whale Activity (0-30 pts): New accounts (<14 days) with large bets (>$2.5k) - 5+=30, 3+=22, 2+=15, 1+=8
3. Timing Urgency (0-20 pts): Days until earnings - ≤2d=20, ≤5d=15, ≤7d=10, ≤14d=5
4. Volume Anomaly (0-10 pts): Current volume vs baseline - 5x+=10, 3x+=7, 2x+=4, 1.5x+=2

**Market Matching:**
- Heuristic text matching between Polymarket market questions and S&P 500 earnings events
- Searches for ticker symbols, company names, and common aliases
- Requires earnings-related keywords: "earnings", "beat", "revenue", "eps", "quarter", etc.

**Cache Configuration:**
- Earnings calendar: 30-minute TTL
- Earnings analysis: 10-minute refresh interval

## Design System

From `design_guidelines.md`:

**Typography:**
- Font: Inter (Google Fonts)
- Page titles: `text-2xl`
- Section headers: `text-lg font-semibold`
- Data: `text-sm`
- Monospace (addresses/numbers): JetBrains Mono

**Layout:**
- Spacing: Tailwind units of 2, 4, 6, 8, 12, 16
- Sidebar: Fixed 240px width (15rem)
- Component padding: `p-4` or `p-6`
- Section spacing: `space-y-6` or `space-y-8`

**Component Patterns:**
- Metric cards: Large number + label
- Tables: Compact row height (h-12), zebra striping, sortable headers
- Badges: Pill-shaped `rounded-full px-3 py-1 text-xs font-medium`
- Risk scores: Horizontal progress bars with color zones

**No hero section** - This is a data dashboard, not a marketing site.

## Key Files

| File | Purpose |
|------|---------|
| `server/storage-interface.ts` | IStorage interface - contract for all storage implementations |
| `server/storage.ts` | Storage singleton export + MemStorage (mock data) |
| `server/polymarket-storage.ts` | PolymarketStorage implementation (live data) |
| `server/polymarket-client.ts` | API client for Polymarket Gamma & Data APIs |
| `server/earnings-client.ts` | Financial Modeling Prep API client for earnings data |
| `server/routes.ts` | Express API route definitions |
| `shared/schema.ts` | Drizzle ORM schemas + Zod validation |
| `client/src/lib/queryClient.ts` | TanStack Query configuration |
| `client/src/App.tsx` | App shell with routing and providers |
| `client/src/components/app-sidebar.tsx` | Navigation sidebar |

## Adding New Features

### Adding a New API Endpoint
1. Add method to `IStorage` interface in `server/storage-interface.ts`
2. Implement in both `MemStorage` (storage.ts) and `PolymarketStorage` (polymarket-storage.ts)
3. Add route handler in `server/routes.ts`
4. Use in frontend with TanStack Query: `useQuery({ queryKey: ["/api/your-endpoint"] })`

### Adding a New Page
1. Create page component in `client/src/pages/`
2. Import and add route in `client/src/App.tsx` Router
3. Add navigation item to `client/src/components/app-sidebar.tsx`
4. Follow design guidelines for layout and spacing

### Adding a New Risk Factor
1. Update risk calculation logic in both storage implementations
2. Modify `calculateRiskScore()` and `calculateRiskFactors()` functions
3. Update `RiskFactors` interface in `shared/schema.ts`
4. Update wallet detail page UI to display new factor

## Environment Variables

- `NODE_ENV` - Set to "production" for optimized builds
- `PORT` - Server port (default: 5000)
- `DATABASE_URL` - PostgreSQL connection string (configured but unused)
- `MOCK_DATA` - Set to "true" to use sample data instead of live Polymarket API
- `FMP_API_KEY` - Financial Modeling Prep API key for earnings data (optional, feature uses mock data if not set)

## Important Notes

- **Type Safety**: All API responses typed via shared schemas in `shared/schema.ts`
- **No Authentication**: Current implementation has no auth - all data is public
- **In-Memory Only**: Data resets on server restart; 5-minute cache TTL on live data
- **Win Rate Estimation**: Win rates are heuristic-based (buy/sell patterns) since resolution data isn't real-time
- **Account Age Estimation**: Based on first observed trade in dataset, not true on-chain account creation

See `PROJECT_STATUS.md` for complete feature list and future enhancements.
