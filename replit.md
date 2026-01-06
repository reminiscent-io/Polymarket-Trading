# Polymarket Insider Trading Detection Dashboard

## Overview
A real-time analytics dashboard for detecting suspicious betting patterns on Polymarket that may indicate insider trading or information asymmetry. The platform monitors wallet activity, calculates risk scores, and surfaces suspicious patterns for investigation.

## Architecture

### Frontend (React + TypeScript)
- **Framework**: React with Vite
- **Routing**: Wouter
- **State Management**: TanStack Query v5
- **UI Components**: Shadcn/ui with Tailwind CSS
- **Theme**: Dark/Light mode support

### Backend (Node.js + Express)
- **Server**: Express.js with TypeScript
- **Storage**: In-memory storage (MemStorage) with sample data
- **API**: RESTful endpoints under `/api/*`

### Data Models
- **Wallet**: Address, risk score, win rate, total bets, volume, account age, portfolio concentration
- **Market**: Name, category, resolution time, suspicious wallet count, avg risk score
- **Transaction**: Wallet ID, market ID, amount, direction, timestamp, outcome

## Risk Scoring Algorithm
Risk scores (0-100) are calculated based on four factors:
1. **Account Age** (0-25 pts): New accounts with large positions score higher
2. **Win Rate** (0-25 pts): >70% accuracy on early bets is suspicious
3. **Portfolio Concentration** (0-25 pts): Single market >60% of capital
4. **Timing Proximity** (0-25 pts): Bets placed within 72h of resolution

Thresholds:
- Critical: 80+
- High: 60-79
- Medium: 40-59
- Low: <40

## Key Pages
- **Dashboard** (`/`): Overview metrics and recently flagged wallets
- **Flagged Wallets** (`/wallets`): Searchable/filterable list of suspicious wallets
- **Wallet Detail** (`/wallets/:id`): Full transaction history and risk breakdown
- **Markets** (`/markets`): Markets with suspicious activity
- **Historical** (`/historical`): Leaderboard of proven insider patterns
- **Settings** (`/settings`): Detection parameters and notifications

## API Endpoints
```
GET /api/stats              - Dashboard statistics
GET /api/wallets            - All wallets (sorted by risk)
GET /api/wallets/flagged    - Flagged wallets only
GET /api/wallets/historical - Historical leaderboard
GET /api/wallets/:id        - Wallet with transactions
GET /api/wallets/:id/risk-factors - Risk breakdown
GET /api/markets            - All markets
GET /api/markets/:id        - Single market
GET /api/transactions       - All transactions
```

## Design System
- **Typography**: Inter for body, JetBrains Mono for wallet addresses and data
- **Colors**: Blue primary (217 91% 35%), with semantic status colors
- **Components**: Shadcn sidebar, tables, cards, badges following design_guidelines.md

## Development
```bash
npm run dev    # Start development server on port 5000
```

## Recent Changes
- Initial MVP implementation (Jan 2026)
- Dashboard with 4 metric cards and flagged wallets table
- Risk scoring algorithm with 4-factor calculation
- Dark mode support
- Sample data seeding for 20 wallets across 10 markets

## User Preferences
- Clean, data-dense interface preferred
- Monospace fonts for wallet addresses and numerical data
- Compact table rows for information density
