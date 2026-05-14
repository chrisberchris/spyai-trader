-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add news sentiment storage
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Store news fetches with sentiment scores
CREATE TABLE IF NOT EXISTS news_snapshots (
  id              SERIAL PRIMARY KEY,
  overall_label   VARCHAR(10),
  overall_score   DECIMAL(5,2),
  bullish_count   INTEGER DEFAULT 0,
  bearish_count   INTEGER DEFAULT 0,
  neutral_count   INTEGER DEFAULT 0,
  total_count     INTEGER DEFAULT 0,
  articles        JSONB,
  source          VARCHAR(50),
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add news_impact column to signals table
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS news_impact    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS news_summary   TEXT,
  ADD COLUMN IF NOT EXISTS calendar_warning TEXT,
  ADD COLUMN IF NOT EXISTS news_snapshot_id INTEGER REFERENCES news_snapshots(id);

-- Index for fast recent lookups
CREATE INDEX IF NOT EXISTS idx_news_snapshots_fetched ON news_snapshots(fetched_at DESC);

-- View: signals with their news context
CREATE OR REPLACE VIEW signals_with_news AS
  SELECT
    s.id, s.signal, s.confidence, s.entry_price, s.target_price, s.stop_loss,
    s.reasoning, s.rsi, s.macd, s.vix, s.created_at,
    s.news_impact, s.news_summary, s.calendar_warning,
    n.overall_label AS news_label,
    n.overall_score AS news_score,
    n.bullish_count, n.bearish_count
  FROM signals s
  LEFT JOIN news_snapshots n ON n.id = s.news_snapshot_id
  ORDER BY s.created_at DESC;
