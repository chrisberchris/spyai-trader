-- ─────────────────────────────────────────────────────────────────────────────
-- SPY AI Trader — Database Schema
-- Run this entire file in your Supabase SQL editor (supabase.com → SQL Editor)
-- ─────────────────────────────────────────────────────────────────────────────

-- Price snapshots: every SPY price tick we record
CREATE TABLE IF NOT EXISTS price_snapshots (
  id          SERIAL PRIMARY KEY,
  symbol      VARCHAR(10) NOT NULL DEFAULT 'SPY',
  price       DECIMAL(10,4) NOT NULL,
  open        DECIMAL(10,4),
  high        DECIMAL(10,4),
  low         DECIMAL(10,4),
  volume      BIGINT,
  vix         DECIMAL(8,4),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI signals: every BUY/SELL/HOLD recommendation the AI generates
CREATE TABLE IF NOT EXISTS signals (
  id            SERIAL PRIMARY KEY,
  symbol        VARCHAR(10) NOT NULL DEFAULT 'SPY',
  signal        VARCHAR(10) NOT NULL CHECK (signal IN ('BUY','SELL','HOLD')),
  confidence    INTEGER NOT NULL,
  entry_price   DECIMAL(10,4),
  target_price  DECIMAL(10,4),
  stop_loss     DECIMAL(10,4),
  reasoning     TEXT,
  rsi           DECIMAL(6,2),
  macd          DECIMAL(8,4),
  vix           DECIMAL(6,2),
  raw_response  JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Options recommendations attached to each signal
CREATE TABLE IF NOT EXISTS options_recommendations (
  id          SERIAL PRIMARY KEY,
  signal_id   INTEGER REFERENCES signals(id) ON DELETE CASCADE,
  option_type VARCHAR(4) NOT NULL CHECK (option_type IN ('CALL','PUT')),
  strike      DECIMAL(10,2) NOT NULL,
  expiry      DATE NOT NULL,
  rationale   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trade log: actual trades taken (manual or simulated)
CREATE TABLE IF NOT EXISTS trades (
  id            SERIAL PRIMARY KEY,
  signal_id     INTEGER REFERENCES signals(id) ON DELETE SET NULL,
  symbol        VARCHAR(10) NOT NULL DEFAULT 'SPY',
  side          VARCHAR(4) NOT NULL CHECK (side IN ('BUY','SELL')),
  quantity      INTEGER NOT NULL DEFAULT 1,
  entry_price   DECIMAL(10,4) NOT NULL,
  exit_price    DECIMAL(10,4),
  pnl           DECIMAL(12,4),
  pnl_pct       DECIMAL(8,4),
  status        VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','CANCELLED')),
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at     TIMESTAMPTZ,
  notes         TEXT
);

-- Backtest runs: store every backtest so you can compare over time
CREATE TABLE IF NOT EXISTS backtests (
  id              SERIAL PRIMARY KEY,
  strategy        VARCHAR(50) NOT NULL,
  period_days     INTEGER NOT NULL,
  starting_capital DECIMAL(12,2) NOT NULL,
  final_capital   DECIMAL(12,2),
  total_return_pct DECIMAL(8,4),
  win_rate_pct    DECIMAL(6,2),
  total_trades    INTEGER,
  max_drawdown_pct DECIMAL(6,2),
  sharpe_ratio    DECIMAL(8,4),
  equity_curve    JSONB,
  trade_log       JSONB,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Portfolio snapshots: daily record of portfolio value
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id            SERIAL PRIMARY KEY,
  cash          DECIMAL(12,2) NOT NULL DEFAULT 10000,
  holdings_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_value   DECIMAL(12,2) NOT NULL DEFAULT 10000,
  spy_price     DECIMAL(10,4),
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_price_snapshots_recorded_at ON price_snapshots(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_opened_at ON trades(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_recorded_at ON portfolio_snapshots(recorded_at DESC);

-- Insert a starting portfolio row
INSERT INTO portfolio_snapshots (cash, holdings_value, total_value)
VALUES (10000, 0, 10000)
ON CONFLICT DO NOTHING;

-- ─── Useful views ─────────────────────────────────────────────────────────────

-- Latest signal
CREATE OR REPLACE VIEW latest_signal AS
  SELECT * FROM signals ORDER BY created_at DESC LIMIT 1;

-- Trade performance summary
CREATE OR REPLACE VIEW trade_performance AS
  SELECT
    COUNT(*) AS total_trades,
    COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_trades,
    COUNT(*) FILTER (WHERE status = 'CLOSED' AND pnl > 0) AS winning_trades,
    ROUND(COUNT(*) FILTER (WHERE status = 'CLOSED' AND pnl > 0)::DECIMAL /
      NULLIF(COUNT(*) FILTER (WHERE status = 'CLOSED'), 0) * 100, 1) AS win_rate_pct,
    ROUND(COALESCE(SUM(pnl) FILTER (WHERE status = 'CLOSED'), 0), 2) AS total_pnl,
    ROUND(COALESCE(AVG(pnl) FILTER (WHERE status = 'CLOSED'), 0), 2) AS avg_pnl
  FROM trades;
