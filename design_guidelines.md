# Polymarket Insider Trading Detection Dashboard - Design Guidelines

## Design Approach

**Selected Framework:** Data Dashboard Pattern (inspired by Linear, Vercel Analytics, Stripe Dashboard)
**Justification:** Utility-focused application requiring efficient data scanning, pattern recognition, and analytical workflows. Prioritizes information density, scannable layouts, and clear visual hierarchy over aesthetic flourishes.

## Typography System

**Font Family:** Inter (Google Fonts) - optimized for data density and screen readability
- **Headings:** 600 weight, tight letter-spacing (-0.02em)
- **Body/Data:** 400 weight for regular text, 500 for emphasis
- **Monospace:** JetBrains Mono for wallet addresses, timestamps, numerical data

**Size Scale:**
- Page titles: text-2xl
- Section headers: text-lg font-semibold
- Table headers: text-sm font-medium uppercase tracking-wide
- Body/data: text-sm
- Metadata/timestamps: text-xs

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4 or p-6
- Section spacing: space-y-6 or space-y-8
- Card gaps: gap-4
- Dense data tables: p-2 for cells

**Grid Structure:**
- Sidebar navigation: Fixed 240px width (hidden on mobile)
- Main content: max-w-7xl with proper horizontal padding
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 for metric cards
- Tables: Full-width with horizontal scroll on mobile

## Component Library

### Navigation
**Top Bar:** Fixed header with logo, search, user profile
**Sidebar:** Vertical navigation with sections: Dashboard, Flagged Wallets, Markets, Historical, Settings

### Dashboard View (Default Landing)
**Metric Cards Row:** 4 key stats (Total Flagged Today, High-Risk Count, Active Markets Monitored, Detection Accuracy)
- Each card: Large number (text-3xl font-bold), label below, micro-trend indicator

**Main Feed:** Real-time flagged wallet table
- Columns: Risk Score (badge), Wallet Address (truncated with copy), Latest Bet Size, Market, Timestamp, Win Rate, Actions
- Sortable headers, pagination at bottom
- Row height: compact (h-12) for information density

### Wallet Detail View
**Header Section:** Wallet address (full, with copy button), overall risk score (large badge), account age, total volume
**Content Grid:** 2-column layout (lg:grid-cols-3)
- Left column (2/3 width): Transaction timeline chart, bet history table
- Right column (1/3 width): Risk factor breakdown (vertical progress bars), quick stats

### Market View
**Market Cards:** List of markets with suspicious activity
- Card layout: Market name, category tag, suspicious wallet count, average risk score, time to resolution
- Click expands to show wallet list for that market

### Data Visualizations
- Timeline charts: Simple line/area charts showing bet timing vs. event resolution
- Risk score: Horizontal progress bars with color zones
- Win rate: Circular progress indicators
- Portfolio concentration: Donut chart (subtle, small)

### Tables
**Style:** Zebra striping (subtle), hover states, sticky headers for long scrolls
**Density:** Compact by default with option to expand rows for details
**Interaction:** Click row to navigate to detail view, inline actions (flag/unflag, notes)

### Badges & Tags
- Risk levels: Pill-shaped badges (rounded-full px-3 py-1 text-xs font-medium)
- Market categories: Subtle outlined tags
- Status indicators: Small dots with labels

### Cards
- Subtle borders (border), slight rounding (rounded-lg)
- Consistent padding (p-6)
- Clear visual separation with minimal shadows

## No Hero Section
This is a dashboard application - direct access to data on load. No marketing hero needed.

## Animations
**Minimal:** 
- Table row hover transitions (transition-colors duration-150)
- Risk score updates: Smooth number counting animation
- Real-time feed: Gentle fade-in for new entries (animate-in)
- No complex scroll animations

## Responsive Behavior
- Mobile: Single column, collapsible sidebar (hamburger menu), horizontal scroll for tables
- Tablet: 2-column grids where applicable, persistent sidebar
- Desktop: Full 3-column layouts, all features visible

## Images
**No images required** - This is a data-focused dashboard. Use iconography from **Heroicons** (outline style) for:
- Navigation items
- Empty states
- Action buttons
- Status indicators