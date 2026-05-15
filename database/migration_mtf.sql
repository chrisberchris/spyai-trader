-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add multi-timeframe analysis columns to signals table
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS timeframe_agreement  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS mtf_daily_bias       VARCHAR(10),
  ADD COLUMN IF NOT EXISTS mtf_hourly_bias      VARCHAR(10),
  ADD COLUMN IF NOT EXISTS mtf_15min_bias       VARCHAR(10),
  ADD COLUMN IF NOT EXISTS confidence_modifier  INTEGER;

-- Updated view: signals with full context
CREATE OR REPLACE VIEW signals_full AS
  SELECT
    s.id, s.signal, s.confidence, s.entry_price, s.target_price, s.stop_loss,
    s.reasoning, s.rsi, s.macd, s.vix, s.created_at,
    s.news_impact, s.news_summary, s.calendar_warning,
    s.timeframe_agreement, s.mtf_daily_bias, s.mtf_hourly_bias, s.mtf_15min_bias,
    s.confidence_modifier,
    n.overall_label AS news_label,
    n.overall_score AS news_score
  FROM signals s
  LEFT JOIN news_snapshots n ON n.id = s.news_snapshot_id
  ORDER BY s.created_at DESC;
