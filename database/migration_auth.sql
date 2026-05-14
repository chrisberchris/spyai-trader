-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add authentication and Row Level Security (RLS)
-- Run this ENTIRE file in your Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add user_id columns to user-specific tables
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE backtests
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE portfolio_snapshots
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Enable Row Level Security on all user-specific tables
ALTER TABLE trades             ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- 3. Trades policies — users only see/modify their own trades
CREATE POLICY "trades_select_own" ON trades
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "trades_insert_own" ON trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trades_update_own" ON trades
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "trades_delete_own" ON trades
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Signals policies — users only see their own signals
CREATE POLICY "signals_select_own" ON signals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "signals_insert_own" ON signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Backtests policies
CREATE POLICY "backtests_select_own" ON backtests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "backtests_insert_own" ON backtests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Portfolio policies
CREATE POLICY "portfolio_select_own" ON portfolio_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "portfolio_insert_own" ON portfolio_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. Shared read-only tables (price_snapshots, news — no RLS needed, public read)
-- These are market data, not user data, so everyone can read them

-- 8. Update trade_performance view to filter by user
CREATE OR REPLACE VIEW trade_performance AS
  SELECT
    COUNT(*) AS total_trades,
    COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_trades,
    COUNT(*) FILTER (WHERE status = 'CLOSED' AND pnl > 0) AS winning_trades,
    ROUND(COUNT(*) FILTER (WHERE status = 'CLOSED' AND pnl > 0)::DECIMAL /
      NULLIF(COUNT(*) FILTER (WHERE status = 'CLOSED'), 0) * 100, 1) AS win_rate_pct,
    ROUND(COALESCE(SUM(pnl) FILTER (WHERE status = 'CLOSED'), 0), 2) AS total_pnl,
    ROUND(COALESCE(AVG(pnl) FILTER (WHERE status = 'CLOSED'), 0), 2) AS avg_pnl
  FROM trades
  WHERE user_id = auth.uid();

-- 9. Indexes for user_id lookups
CREATE INDEX IF NOT EXISTS idx_trades_user_id    ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_user_id   ON signals(user_id);
CREATE INDEX IF NOT EXISTS idx_backtests_user_id ON backtests(user_id);
