-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Analytics & auto-tracking
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Add outcome tracking to signals table
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS outcome           VARCHAR(10),  -- HIT_TARGET, HIT_STOP, EXPIRED, PENDING
  ADD COLUMN IF NOT EXISTS outcome_price     DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS outcome_pnl_pct   DECIMAL(8,4),
  ADD COLUMN IF NOT EXISTS outcome_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timeframe_agreement VARCHAR(20),
  ADD COLUMN IF NOT EXISTS volume_label      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS rotation_signal   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS flow_bias         VARCHAR(20),
  ADD COLUMN IF NOT EXISTS put_call_ratio    DECIMAL(6,3),
  ADD COLUMN IF NOT EXISTS futures_bias      VARCHAR(10),
  ADD COLUMN IF NOT EXISTS gap_type          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS news_impact       VARCHAR(20);

-- Personal trades table — user-executed trades linked to signals
CREATE TABLE IF NOT EXISTS personal_trades (
  id              SERIAL PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_id       INTEGER REFERENCES signals(id) ON DELETE SET NULL,
  symbol          VARCHAR(10) NOT NULL DEFAULT 'SPY',
  side            VARCHAR(4) NOT NULL CHECK (side IN ('BUY','SELL')),
  trade_type      VARCHAR(10) DEFAULT 'STOCK' CHECK (trade_type IN ('STOCK','CALL','PUT')),
  quantity        INTEGER NOT NULL DEFAULT 1,
  entry_price     DECIMAL(10,4) NOT NULL,
  exit_price      DECIMAL(10,4),
  target_price    DECIMAL(10,4),
  stop_loss       DECIMAL(10,4),
  pnl             DECIMAL(12,4),
  pnl_pct         DECIMAL(8,4),
  status          VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','CANCELLED')),
  followed_signal BOOLEAN DEFAULT TRUE,
  deviation_notes TEXT,   -- why they deviated from signal if they did
  emotion_rating  INTEGER CHECK (emotion_rating BETWEEN 1 AND 5),  -- 1=fearful 5=confident
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  notes           TEXT
);

-- Enable RLS on personal_trades
ALTER TABLE personal_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_trades_select_own" ON personal_trades
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "personal_trades_insert_own" ON personal_trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "personal_trades_update_own" ON personal_trades
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "personal_trades_delete_own" ON personal_trades
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_personal_trades_user_id  ON personal_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_trades_signal_id ON personal_trades(signal_id);
CREATE INDEX IF NOT EXISTS idx_signals_outcome ON signals(outcome);
CREATE INDEX IF NOT EXISTS idx_signals_user_created ON signals(user_id, created_at DESC);

-- Analytics view: signal accuracy per user
CREATE OR REPLACE VIEW signal_accuracy AS
  SELECT
    user_id,
    COUNT(*) AS total_signals,
    COUNT(*) FILTER (WHERE signal = 'BUY')  AS buy_signals,
    COUNT(*) FILTER (WHERE signal = 'SELL') AS sell_signals,
    COUNT(*) FILTER (WHERE signal = 'HOLD') AS hold_signals,
    COUNT(*) FILTER (WHERE outcome IS NOT NULL AND outcome != 'PENDING') AS resolved_signals,
    COUNT(*) FILTER (WHERE outcome = 'HIT_TARGET') AS targets_hit,
    COUNT(*) FILTER (WHERE outcome = 'HIT_STOP')   AS stops_hit,
    ROUND(COUNT(*) FILTER (WHERE outcome = 'HIT_TARGET')::DECIMAL /
      NULLIF(COUNT(*) FILTER (WHERE outcome IN ('HIT_TARGET','HIT_STOP')), 0) * 100, 1) AS signal_win_rate,
    ROUND(AVG(confidence), 1) AS avg_confidence,
    ROUND(AVG(CASE WHEN outcome = 'HIT_TARGET' THEN confidence END), 1) AS avg_confidence_winners,
    ROUND(AVG(CASE WHEN outcome = 'HIT_STOP' THEN confidence END), 1) AS avg_confidence_losers
  FROM signals
  GROUP BY user_id;

-- Analytics view: personal trade performance per user
CREATE OR REPLACE VIEW personal_trade_performance AS
  SELECT
    user_id,
    COUNT(*) AS total_trades,
    COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_trades,
    COUNT(*) FILTER (WHERE status = 'CLOSED' AND pnl > 0) AS winning_trades,
    COUNT(*) FILTER (WHERE status = 'CLOSED' AND pnl <= 0) AS losing_trades,
    ROUND(COUNT(*) FILTER (WHERE status = 'CLOSED' AND pnl > 0)::DECIMAL /
      NULLIF(COUNT(*) FILTER (WHERE status = 'CLOSED'), 0) * 100, 1) AS win_rate_pct,
    ROUND(COALESCE(SUM(pnl) FILTER (WHERE status = 'CLOSED'), 0), 2) AS total_pnl,
    ROUND(COALESCE(AVG(pnl) FILTER (WHERE status = 'CLOSED'), 0), 2) AS avg_pnl,
    ROUND(COALESCE(MAX(pnl) FILTER (WHERE status = 'CLOSED'), 0), 2) AS best_trade,
    ROUND(COALESCE(MIN(pnl) FILTER (WHERE status = 'CLOSED'), 0), 2) AS worst_trade,
    COUNT(*) FILTER (WHERE followed_signal = TRUE)  AS followed_signal_count,
    COUNT(*) FILTER (WHERE followed_signal = FALSE) AS deviated_count
  FROM personal_trades
  GROUP BY user_id;
