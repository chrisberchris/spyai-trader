require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const db = require('./db');
const {
  getSpySnapshot, getVix, getHistoricalBars,
  getIntradayBars, getPreMarketData, getFuturesData, buildPreMarketContext
} = require('./marketData');
const { calcAllIndicators, calcMultiTimeframe, calcVolumeAnalysis, calcConfidenceScore } = require('./indicators');
const { generateSignal } = require('./aiAnalysis');
const { runBacktest } = require('./backtest');
const { getMarketNews, getEconomicCalendar, buildNewsContext } = require('./news');
const { getSectorData, buildSectorContext } = require('./sectors');
const { getOptionsFlow, buildOptionsFlowContext } = require('./optionsFlow');
const { requireAuth } = require('./authMiddleware');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ─── Market Data ─────────────────────────────────────────────────────────────
app.get('/api/market/snapshot', async (req, res) => {
  try {
    const [quote, vix] = await Promise.all([getSpySnapshot(), getVix()]);
    if (!quote) return res.status(503).json({ error: 'Market data unavailable' });

    // Store price snapshot
    await db.query(
      `INSERT INTO price_snapshots (symbol, price, open, high, low, volume, vix)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['SPY', quote.price, quote.open, quote.high, quote.low, quote.volume, vix]
    );

    res.json({ ...quote, vix });
  } catch (err) {
    console.error('Snapshot error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/market/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const bars = await getHistoricalBars('SPY', days);
    res.json({ bars, count: bars.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/market/prices', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 200;
    const { rows } = await db.query(
      `SELECT price, volume, vix, recorded_at FROM price_snapshots
       ORDER BY recorded_at DESC LIMIT $1`, [limit]
    );
    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/market/options-flow', async (req, res) => {
  try {
    const flow = await getOptionsFlow('SPY');
    if (!flow) return res.status(503).json({ error: 'Options data unavailable' });
    res.json(flow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/market/sectors', async (req, res) => {
  try {
    const data = await getSectorData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/market/premarket', async (req, res) => {
  try {
    const [preMarket, futures] = await Promise.all([
      getPreMarketData(),
      getFuturesData()
    ]);
    res.json({ preMarket, futures, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── News & Calendar ─────────────────────────────────────────────────────────
app.get('/api/news', async (req, res) => {
  try {
    const [newsData, calendar] = await Promise.all([
      getMarketNews(),
      getEconomicCalendar()
    ]);
    res.json({ ...newsData, calendar });
  } catch (err) {
    console.error('News error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/news/calendar', async (req, res) => {
  try {
    const calendar = await getEconomicCalendar();
    res.json(calendar);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Signal ───────────────────────────────────────────────────────────────
app.post('/api/signal/generate', requireAuth, async (req, res) => {
  try {
    // Fetch everything in parallel for speed
    const [bars, hourlyBars, bars15m, quote, vix, newsData, calendar, preMarket, futures, sectorData, optionsFlow] = await Promise.allSettled([
      getHistoricalBars('SPY', 220),
      getIntradayBars('SPY', 1, 'hour', 7),
      getIntradayBars('SPY', 15, 'minute', 3),
      getSpySnapshot(),
      getVix(),
      getMarketNews(),
      getEconomicCalendar(),
      getPreMarketData(),
      getFuturesData(),
      getSectorData(),
      getOptionsFlow('SPY')
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : null));

    if (!bars.length) return res.status(503).json({ error: 'Cannot fetch market data' });

    const indicators = calcAllIndicators(bars);

    // Multi-timeframe analysis
    const mtf = calcMultiTimeframe(bars, hourlyBars, bars15m);

    // Volume confirmation analysis
    const volumeAnalysis = calcVolumeAnalysis(bars, quote?.volume);

    // Build news context string for AI prompt
    const newsContext = buildNewsContext({
      articles: newsData.articles,
      overall: newsData.overall,
      calendarEvents: calendar.events
    });

    // Build calendar warning string if high-impact event approaching
    const calendarWarning = calendar.hasHighImpact
      ? calendar.events.map(e => e.event).join(', ')
      : null;

    // Build pre-market context for AI
    const preMarketContext = buildPreMarketContext(preMarket, futures);

    // Build sector rotation context for AI
    const sectorContext = buildSectorContext(sectorData);

    // Build options flow context for AI
    const optionsFlowContext = buildOptionsFlowContext(optionsFlow);

    const signal = await generateSignal({
      price: quote?.price || indicators.price,
      indicators,
      vix,
      volume: quote?.volume,
      avgVolume: 80000000,
      newsContext,
      calendarWarning,
      mtf,
      volumeAnalysis,
      preMarketContext,
      preMarket,
      futures,
      sectorContext,
      sectorData,
      optionsFlowContext,
      optionsFlow
    });

    // Auto-scale confidence based on all available context
    const confidenceScore = calcConfidenceScore({
      aiBaseConfidence: signal.confidence,
      vix,
      volumeAnalysis,
      mtf,
      sectorData,
      preMarket,
      futures,
      newsImpact: signal.news_impact,
      calendarWarning,
      optionsFlow
    });

    // Persist signal to DB
    const { rows } = await db.query(
      `INSERT INTO signals (symbol, signal, confidence, entry_price, target_price, stop_loss,
        reasoning, rsi, macd, vix, raw_response, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      ['SPY', signal.signal, confidenceScore.adjusted, signal.entry_price, signal.target_price,
       signal.stop_loss, signal.reasoning, indicators.rsi, indicators.macd, vix,
       JSON.stringify(signal), req.userId]
    );

    const signalId = rows[0].id;

    // Persist options recommendations
    if (signal.options?.length) {
      for (const opt of signal.options) {
        await db.query(
          `INSERT INTO options_recommendations (signal_id, option_type, strike, expiry, rationale)
           VALUES ($1,$2,$3,$4,$5)`,
          [signalId, opt.type, opt.strike, opt.expiry, opt.rationale]
        );
      }
    }

    res.json({
      signalId,
      ...signal,
      confidence: confidenceScore.adjusted,  // override AI confidence with auto-scaled value
      confidenceScore,
      indicators,
      volumeAnalysis,
      preMarket,
      futures,
      optionsFlow,
      sectorData: {
        rotation: sectorData?.rotation,
        leaders:  sectorData?.leaders,
        laggards: sectorData?.laggards,
        sectors:  sectorData?.sectors,
        fetchedAt: sectorData?.fetchedAt
      },
      mtf: {
        agreement: mtf.agreement,
        confidenceModifier: mtf.confidenceModifier,
        daily:  { bias: mtf.daily.bias,  rsi: mtf.daily.rsi,  macd: mtf.daily.macd,  sufficient: mtf.daily.sufficient  },
        hourly: { bias: mtf.hourly.bias, rsi: mtf.hourly.rsi, macd: mtf.hourly.macd, sufficient: mtf.hourly.sufficient },
        m15:    { bias: mtf.m15.bias,    rsi: mtf.m15.rsi,    macd: mtf.m15.macd,    sufficient: mtf.m15.sufficient    },
      },
      newsData: {
        overall: newsData.overall,
        articles: newsData.articles?.slice(0, 8),
        calendar: calendar.events,
        hasCalendarWarning: calendar.hasHighImpact,
        source: newsData.source,
        fetchedAt: newsData.fetchedAt
      }
    });
  } catch (err) {
    console.error('Signal error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/signal/latest', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, json_agg(o.*) FILTER (WHERE o.id IS NOT NULL) as options
       FROM signals s
       LEFT JOIN options_recommendations o ON o.signal_id = s.id
       ORDER BY s.created_at DESC LIMIT 1
       GROUP BY s.id`
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/signal/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const { rows } = await db.query(
      `SELECT id, signal, confidence, entry_price, target_price, stop_loss,
              reasoning, rsi, macd, vix, created_at
       FROM signals ORDER BY created_at DESC LIMIT $1`, [limit]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Trades ──────────────────────────────────────────────────────────────────
app.get('/api/trades', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM trades WHERE user_id=$1 ORDER BY opened_at DESC LIMIT 100`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trades', requireAuth, async (req, res) => {
  try {
    const { signal_id, side, quantity = 1, entry_price, notes } = req.body;
    const { rows } = await db.query(
      `INSERT INTO trades (signal_id, side, quantity, entry_price, notes, user_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [signal_id, side, quantity, entry_price, notes, req.userId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/trades/:id/close', requireAuth, async (req, res) => {
  try {
    const { exit_price, notes } = req.body;
    const { rows: [trade] } = await db.query(
      'SELECT * FROM trades WHERE id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    );
    if (!trade) return res.status(404).json({ error: 'Trade not found' });

    const pnl    = (exit_price - trade.entry_price) * trade.quantity * (trade.side === 'BUY' ? 1 : -1);
    const pnlPct = (exit_price - trade.entry_price) / trade.entry_price * 100;

    const { rows } = await db.query(
      `UPDATE trades SET exit_price=$1, pnl=$2, pnl_pct=$3, status='CLOSED',
        closed_at=NOW(), notes=COALESCE($4, notes)
       WHERE id=$5 AND user_id=$6 RETURNING *`,
      [exit_price, pnl.toFixed(4), pnlPct.toFixed(4), notes, req.params.id, req.userId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trades/performance', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
        COUNT(*) AS total_trades,
        COUNT(*) FILTER (WHERE status='CLOSED') AS closed_trades,
        COUNT(*) FILTER (WHERE status='CLOSED' AND pnl > 0) AS winning_trades,
        ROUND(COUNT(*) FILTER (WHERE status='CLOSED' AND pnl > 0)::DECIMAL /
          NULLIF(COUNT(*) FILTER (WHERE status='CLOSED'),0)*100,1) AS win_rate_pct,
        ROUND(COALESCE(SUM(pnl) FILTER (WHERE status='CLOSED'),0),2) AS total_pnl,
        ROUND(COALESCE(AVG(pnl) FILTER (WHERE status='CLOSED'),0),2) AS avg_pnl
       FROM trades WHERE user_id=$1`,
      [req.userId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Backtest ─────────────────────────────────────────────────────────────────
app.post('/api/backtest/run', requireAuth, async (req, res) => {
  try {
    const { strategy = 'combo', period_days = 90, starting_capital = 10000 } = req.body;
    const bars = await getHistoricalBars('SPY', period_days + 30);
    if (bars.length < 60) return res.status(503).json({ error: 'Not enough historical data' });

    const result = runBacktest({ bars, strategy, startingCapital: starting_capital });

    await db.query(
      `INSERT INTO backtests (strategy, period_days, starting_capital, final_capital,
        total_return_pct, win_rate_pct, total_trades, max_drawdown_pct, equity_curve, trade_log, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [strategy, period_days, starting_capital, result.finalEquity, result.totalReturn,
       result.winRate, result.totalTrades, result.maxDrawdown,
       JSON.stringify(result.equityCurve), JSON.stringify(result.trades), req.userId]
    );

    res.json(result);
  } catch (err) {
    console.error('Backtest error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backtest/history', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, strategy, period_days, starting_capital, final_capital,
              total_return_pct, win_rate_pct, total_trades, max_drawdown_pct, run_at
       FROM backtests WHERE user_id=$1 ORDER BY run_at DESC LIMIT 20`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Portfolio ───────────────────────────────────────────────────────────────
app.get('/api/portfolio', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM portfolio_snapshots ORDER BY recorded_at DESC LIMIT 90`
    );
    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Cron: record price every 5 minutes during market hours ──────────────────
cron.schedule('*/5 9-16 * * 1-5', async () => {
  try {
    const [quote, vix] = await Promise.all([getSpySnapshot(), getVix()]);
    if (!quote) return;
    await db.query(
      `INSERT INTO price_snapshots (symbol, price, open, high, low, volume, vix)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['SPY', quote.price, quote.open, quote.high, quote.low, quote.volume, vix]
    );
    console.log(`[${new Date().toISOString()}] Recorded SPY: $${quote.price}`);
  } catch (err) {
    console.error('Cron error:', err.message);
  }
}, { timezone: 'America/New_York' });

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SPY AI Trader backend running on port ${PORT}`);
});
