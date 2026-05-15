-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Auto-trading tables
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto trades — every trade the system executes automatically
CREATE TABLE IF NOT EXISTS auto_trades (
  id                SERIAL PRIMARY KEY,
  run_id            VARCHAR(50) NOT NULL,
  signal_id         INTEGER REFERENCES signals(id) ON DELETE SET NULL,
  alpaca_order_id   VARCHAR(100),
  symbol            VARCHAR(10) NOT NULL DEFAULT 'SPY',
  side              VARCHAR(4) NOT NULL CHECK (side IN ('BUY','SELL')),
  qty               INTEGER NOT NULL,
  entry_price       DECIMAL(10,4),
  exit_price        DECIMAL(10,4),
  target_price      DECIMAL(10,4),
  stop_loss         DECIMAL(10,4),
  confidence        INTEGER,
  position_size_pct DECIMAL(6,4),
  pnl               DECIMAL(12,4),
  pnl_pct           DECIMAL(8,4),
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','FILLED','CLOSED','CANCELLED','ERROR')),
  outcome           VARCHAR(10) CHECK (outcome IN ('WIN','LOSS','BREAKEVEN')),
  gates_passed      BOOLEAN DEFAULT TRUE,
  scan_notes        TEXT,
  filled_at         TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Every scan the system runs (including skipped ones — important for analysis)
CREATE TABLE IF NOT EXISTS auto_trade_scans (
  id            SERIAL PRIMARY KEY,
  run_id        VARCHAR(50) NOT NULL,
  status        VARCHAR(30) NOT NULL,  -- EXECUTED, GATES_FAILED, MARKET_CLOSED, ERROR, etc.
  signal        VARCHAR(10),
  confidence    INTEGER,
  reason        TEXT,
  signal_id     INTEGER REFERENCES signals(id) ON DELETE SET NULL,
  auto_trade_id INTEGER REFERENCES auto_trades(id) ON DELETE SET NULL,
  scanned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auto_trades_status     ON auto_trades(status);
CREATE INDEX IF NOT EXISTS idx_auto_trades_created_at ON auto_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_trade_scans_run_id ON auto_trade_scans(run_id);
CREATE INDEX IF NOT EXISTS idx_auto_trade_scans_status ON auto_trade_scans(status);

-- View: auto-trade performance summary
CREATE OR REPLACE VIEW auto_trade_performance AS
  SELECT
    COUNT(*) AS total_trades,
    COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_trades,
    COUNT(*) FILTER (WHERE outcome = 'WIN')   AS wins,
    COUNT(*) FILTER (WHERE outcome = 'LOSS')  AS losses,
    ROUND(COUNT(*) FILTER (WHERE outcome = 'WIN')::DECIMAL /
      NULLIF(COUNT(*) FILTER (WHERE outcome IN ('WIN','LOSS')), 0) * 100, 1) AS win_rate_pct,
    ROUND(COALESCE(SUM(pnl) FILTER (WHERE status = 'CLOSED'), 0), 2) AS total_pnl,
    ROUND(COALESCE(AVG(pnl) FILTER (WHERE status = 'CLOSED'), 0), 2) AS avg_pnl,
    ROUND(COALESCE(MAX(pnl), 0), 2) AS best_trade,
    ROUND(COALESCE(MIN(pnl), 0), 2) AS worst_trade,
    ROUND(AVG(confidence), 1) AS avg_confidence
  FROM auto_trades;

-- View: scan summary (why trades were skipped)
CREATE OR REPLACE VIEW scan_summary AS
  SELECT
    status,
    COUNT(*) AS count,
    ROUND(COUNT(*)::DECIMAL / SUM(COUNT(*)) OVER () * 100, 1) AS pct
  FROM auto_trade_scans
  GROUP BY status
  ORDER BY count DESC;
