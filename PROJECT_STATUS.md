# Polymarket Insider Trading Detection Dashboard - Project Status

## What Was Built

### Core Features

#### Dashboard (/)
- **Metric Cards**: 4 key performance indicators
  - Total flagged wallets today
  - High-risk wallets count (score 60+)
  - Active markets being monitored
  - Detection accuracy percentage
- **Recently Flagged Table**: Top 10 suspicious wallets with quick-view data
- Real-time data updates via API

#### Flagged Wallets (/wallets)
- Complete list of all flagged wallets sorted by risk score
- Search functionality by wallet address
- Filter by risk level (All, Critical, High, Medium, Low)
- Clickable rows to view wallet details

#### Wallet Detail (/wallets/:id)
- Full wallet profile with all metrics
- **Risk Factor Breakdown**: Visual progress bars showing contribution from each factor
  - Account Age (0-25 pts)
  - Win Rate (0-25 pts)
  - Portfolio Concentration (0-25 pts)
  - Timing Proximity (0-25 pts)
- **Transaction History**: Complete list of all bets with market names, amounts, directions, and outcomes
- Notes section for analyst annotations

#### Markets (/markets)
- List of all monitored prediction markets
- Suspicious wallet count per market
- Average risk score of flagged wallets per market
- Total trading volume
- Market category tags (Crypto, Politics, Sports, Finance, etc.)

#### Historical Leaderboard (/historical)
- Ranked list of wallets with proven suspicious patterns
- Win rate tracking
- Total volume traded
- Account age at time of flagging

#### Settings (/settings)
- Risk threshold configuration sliders
- Notification preferences (toggles for email, alerts, reports)
- Display preferences

### Technical Implementation

#### Frontend
- React + TypeScript with Vite
- Shadcn/ui component library
- TanStack Query for data fetching
- Wouter for routing
- Dark/light theme support with system preference detection

#### Backend
- Express.js API server
- Live Polymarket data integration (Real-time wallet and market monitoring)
- Financial Modeling Prep (FMP) integration for earnings data (with graceful mock fallback for 403/limit errors)
- RESTful API endpoints:
  - `GET /api/stats` - Dashboard metrics
  - `GET /api/wallets` - All wallets
  - `GET /api/wallets/flagged` - Flagged wallets only
  - `GET /api/wallets/historical` - Historical leaderboard
  - `GET /api/wallets/:id` - Single wallet with transactions
  - `GET /api/wallets/:id/risk-factors` - Risk breakdown
  - `GET /api/markets` - All markets
  - `GET /api/earnings` - Earnings-related markets and alerts

#### Risk Scoring Algorithm
- **Standard Risk (0-100)**: Account age, win rate, concentration, timing, position size.
- **Earnings Insider Risk (0-100)**: Analyst divergence, whale activity, timing urgency, volume anomalies.

---

## Polymarket Integration (NEW)

### Live Data Connection
The dashboard now connects to **real Polymarket blockchain data** via their public APIs:

#### API Endpoints Used
- **Gamma API**: `https://gamma-api.polymarket.com/markets` - Fetches active prediction markets
- **Data API**: `https://data-api.polymarket.com/trades` - Fetches recent trades and wallet activity

#### Features
- **Real Markets**: Fetches 50+ active prediction markets with live volume data
- **Real Wallets**: Analyzes 200+ wallets from recent trade data
- **Risk Analysis**: Calculates risk scores based on actual trading patterns:
  - Account age (estimated from first trade)
  - Win rate (estimated from buy/sell patterns)
  - Portfolio concentration (volume distribution across markets)
  - Trade timing proximity
- **Caching**: 5-minute TTL cache to prevent API rate limiting
- **Fallback**: Set `MOCK_DATA=true` environment variable to use sample data instead

#### New Files
| File | Purpose |
|------|---------|
| `server/polymarket-client.ts` | API client for Polymarket Gamma & Data APIs |
| `server/polymarket-storage.ts` | Storage implementation using live API data |
| `server/storage-interface.ts` | Shared interface for storage implementations |

---

## Outstanding / Future Enhancements

### Data & Integration
- [x] Connect to real Polymarket API for live wallet data
- [ ] Implement database persistence (PostgreSQL) instead of in-memory storage
- [ ] Add WebSocket support for real-time updates
- [ ] Integrate with blockchain explorers for transaction verification
- [ ] Add The Graph subgraph integration for more detailed on-chain data

### Detection Enhancements
- [ ] Machine learning model for pattern recognition
- [ ] Cluster analysis to identify coordinated wallet groups
- [ ] Time-series analysis for betting pattern anomalies
- [ ] Cross-market correlation detection
- [ ] Whale wallet tracking and alerts

### User Features
- [ ] User authentication and role-based access
- [ ] Custom watchlists for specific wallets
- [ ] Export functionality (CSV, PDF reports)
- [ ] Email/Slack notifications for new flagged wallets
- [ ] Annotation and case management system
- [ ] Audit trail for analyst actions

### Analytics & Visualization
- [ ] Historical trends charts
- [ ] Network graph showing wallet relationships
- [ ] Market heatmaps by suspicious activity
- [ ] Time-based activity charts per wallet
- [ ] Probability distribution of risk scores

### Settings & Configuration
- [ ] Save settings to database
- [ ] Custom detection rule builder
- [ ] API rate limiting configuration
- [ ] Whitelist management for known-good wallets

### Performance & Scale
- [ ] Pagination for large datasets
- [ ] Caching layer for frequently accessed data
- [ ] Background job processing for risk calculations
- [ ] Database indexing for fast queries

---

## Known Limitations

1. ~~**Sample Data Only**: Currently uses generated sample data, not connected to real Polymarket~~ **RESOLVED** - Now connects to live Polymarket APIs
2. **In-Memory Storage**: Data resets on server restart (cached data refreshes every 5 minutes)
3. **No Authentication**: Open access to all features
4. **Static Risk Thresholds**: Settings page UI exists but doesn't persist changes
5. **Win Rate Estimation**: Win rates are estimated from buy/sell patterns since resolution data isn't available in real-time
6. **Account Age Estimation**: Account age is estimated from first observed trade in the dataset

---

## Files Reference

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Data models and TypeScript types |
| `server/storage.ts` | Storage exports and mock data implementation |
| `server/storage-interface.ts` | IStorage interface definition |
| `server/polymarket-client.ts` | Polymarket API client (Gamma & Data APIs) |
| `server/polymarket-storage.ts` | Live Polymarket data storage implementation |
| `server/routes.ts` | API endpoint definitions |
| `client/src/App.tsx` | Main app with routing |
| `client/src/pages/dashboard.tsx` | Dashboard page |
| `client/src/pages/wallets.tsx` | Wallet list page |
| `client/src/pages/wallet-detail.tsx` | Wallet detail page |
| `client/src/pages/markets.tsx` | Markets page |
| `client/src/pages/historical.tsx` | Historical leaderboard |
| `client/src/pages/settings.tsx` | Settings page |
| `client/src/components/app-sidebar.tsx` | Navigation sidebar |
| `design_guidelines.md` | UI/UX design specifications |
