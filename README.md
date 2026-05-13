# SPY AI Trader — Full Stack

AI-powered SPY trading dashboard with real market data, persistent trade log, and backtesting.

## Stack
- **Frontend**: React + Recharts → hosted on Vercel (free)
- **Backend**: Node.js + Express → hosted on Render (free)
- **Database**: PostgreSQL → hosted on Supabase (free)
- **Market Data**: Polygon.io (free tier) with Yahoo Finance fallback
- **AI Signals**: Anthropic Claude API

---

## Step-by-Step Setup

### 1. Get your free API keys

| Service | URL | What you need |
|---|---|---|
| Supabase | https://supabase.com | Project → Settings → Database URL |
| Polygon.io | https://polygon.io | API Keys page |
| Anthropic | https://console.anthropic.com | API Keys page (add ~$5 credit) |
| GitHub | https://github.com | Create free account |
| Render | https://render.com | Create free account |
| Vercel | https://vercel.com | Create free account |

---

### 2. Set up the database (Supabase)

1. Go to https://supabase.com → create a new project
2. Wait ~2 minutes for it to spin up
3. Click **SQL Editor** in the left sidebar
4. Paste the entire contents of `database/schema.sql`
5. Click **Run**
6. Go to **Project Settings → Database → Connection string** and copy the URI

---

### 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial SPY AI Trader"
git remote add origin https://github.com/YOUR_USERNAME/spyai-trader.git
git push -u origin main
```

---

### 4. Deploy the backend (Render)

1. Go to https://render.com → New → **Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Root directory**: `backend`
   - **Build command**: `npm install`
   - **Start command**: `node server.js`
4. Add Environment Variables:
   ```
   DATABASE_URL=postgresql://...  (from Supabase)
   POLYGON_API_KEY=your_key
   ANTHROPIC_API_KEY=your_key
   FRONTEND_URL=https://your-app.vercel.app
   PORT=3001
   ```
5. Click **Create Web Service** → wait ~3 minutes
6. Copy your Render URL: `https://spyai-trader-xxxx.onrender.com`

---

### 5. Deploy the frontend (Vercel)

1. Go to https://vercel.com → New Project → import your GitHub repo
2. Settings:
   - **Root directory**: `frontend`
   - **Framework**: Create React App
3. Add Environment Variable:
   ```
   REACT_APP_API_URL=https://spyai-trader-xxxx.onrender.com
   ```
4. Click **Deploy** → wait ~2 minutes
5. Your app is live at `https://spyai-trader.vercel.app`

---

### 6. Run locally (optional)

**Backend:**
```bash
cd backend
cp .env.example .env
# Fill in your keys in .env
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
# REACT_APP_API_URL= (leave blank for local, proxy handles it)
npm install
npm start
```

---

## Features

- **Dashboard**: Real SPY price, AI buy/sell/hold signal with reasoning, options recommendations, sentiment analysis, technical indicators (RSI, MACD, MA crossover, Bollinger Bands)
- **Live Feed**: Streaming price chart updated every 15 seconds, tick log, session stats
- **Trade Log**: Every AI signal auto-logged to database, close trades with exit price, P&L tracking, win rate stats
- **Backtest**: 4 strategies (RSI, MACD, MA, Combined) on real historical SPY data, equity curve vs buy-and-hold, all runs saved to database

## ⚠️ Disclaimer

For educational purposes only. Not financial advice. Options and stock trading involve substantial risk of loss. Past backtest performance does not guarantee future results. Always consult a licensed financial advisor before making trading decisions.
