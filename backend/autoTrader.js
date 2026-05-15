const db = require('./db');
const {
  getHistoricalBars, getIntradayBars, getSpySnapshot,
  getVix, getPreMarketData, getFuturesData, buildPreMarketContext
} = require('./marketData');
const { calcAllIndicators, calcMultiTimeframe, calcVolumeAnalysis, calcConfidenceScore } = require('./indicators');
const { generateSignal } = require('./aiAnalysis');
const { getMarketNews, getEconomicCalendar, buildNewsContext } = require('./news');
const { getSectorData, buildSectorContext } = require('./sectors');
const {
  getAccount, getMarketStatus, getPosition, getPositions,
  placeBracketOrder, closePosition, calcPositionSize
} = require('./alpaca');

// ─── Trading gates — ALL must pass before executing a trade ──────────────────
const GATES = {
  MIN_CONFIDENCE:       75,   // minimum adjusted confidence score
  MAX_VIX:              28,   // don't trade when fear index is extreme
  MIN_VOLUME_LABELS:    ['NORMAL', 'HIGH', 'VERY_HIGH'],  // no low-volume trades
  BLOCKED_MTF:          ['MIXED'],  // don't trade when timeframes conflict
  BLOCKED_ROTATION:     [],         // could add RISK_OFF here later
  MIN_SIGNAL:           ['BUY', 'SELL'],  // no HOLD trades
  CALENDAR_BLOCK_HOURS: 24,   // block if major event within 24 hours
};

function checkGates({ signal, confidence, confidenceScore, vix, volumeAnalysis, mtf, calendarWarning, hasPosition }) {
  const failed = [];

  if (!GATES.MIN_SIGNAL.includes(signal))
    failed.push(`Signal is HOLD — no trade`);

  if (confidence < GATES.MIN_CONFIDENCE)
    failed.push(`Confidence ${confidence} below minimum ${GATES.MIN_CONFIDENCE}`);

  if (confidenceScore?.positionSize === 'AVOID' || confidenceScore?.positionSize === 'SMALL')
    failed.push(`Position size recommendation is ${confidenceScore.positionSize} — skipping`);

  if (vix && vix > GATES.MAX_VIX)
    failed.push(`VIX ${vix} exceeds maximum ${GATES.MAX_VIX}`);

  if (volumeAnalysis && !GATES.MIN_VOLUME_LABELS.includes(volumeAnalysis.label))
    failed.push(`Volume is ${volumeAnalysis.label} — insufficient confirmation`);

  if (mtf && GATES.BLOCKED_MTF.includes(mtf.agreement))
    failed.push(`Timeframe agreement is ${mtf.agreement} — conflicting signals`);

  if (calendarWarning)
    failed.push(`High-impact event within 24h: ${calendarWarning}`);

  // Don't double up — only one SPY position at a time
  if (hasPosition)
    failed.push(`Already have an open SPY position`);

  return { passed: failed.length === 0, reasons: failed };
}

// ─── Main auto-trade function — called by cron ────────────────────────────────
async function runAutoTrade() {
  const runId = `auto_${Date.now()}`;
  console.log(`[AutoTrade ${runId}] Starting scan...`);

  try {
    // 1. Check market is open
    const clock = await getMarketStatus();
    if (!clock.isOpen) {
      console.log(`[AutoTrade ${runId}] Market closed — skipping`);
      await logScan({ runId, status: 'MARKET_CLOSED', reason: 'Market not open' });
      return;
    }

    // 2. Check account health
    const account = await getAccount();
    if (account.tradingBlocked || account.accountBlocked) {
      console.log(`[AutoTrade ${runId}] Account blocked — skipping`);
      await logScan({ runId, status: 'ACCOUNT_BLOCKED', reason: 'Account trading blocked' });
      return;
    }

    // 3. Check for existing SPY position
    const existingPosition = await getPosition('SPY');

    // 4. Fetch all market data in parallel
    const [bars, hourlyBars, bars15m, quote, vix, newsData, calendar, preMarket, futures, sectorData] =
      await Promise.allSettled([
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
      ]).then(r => r.map(x => x.status === 'fulfilled' ? x.value : null));

    if (!bars?.length) {
      await logScan({ runId, status: 'NO_DATA', reason: 'Could not fetch market data' });
      return;
    }

    const indicators       = calcAllIndicators(bars);
    const mtf              = calcMultiTimeframe(bars, hourlyBars, bars15m);
    const volumeAnalysis   = calcVolumeAnalysis(bars, quote?.volume);
    const newsContext      = buildNewsContext({ articles: newsData?.articles, overall: newsData?.overall, calendarEvents: calendar?.events });
    const preMarketContext = buildPreMarketContext(preMarket, futures);
    const sectorContext    = buildSectorContext(sectorData);
    const calendarWarning  = calendar?.hasHighImpact ? calendar.events.map(e => e.event).join(', ') : null;

    // 5. Run AI analysis
    const signal = await generateSignal({
      price: quote?.price || indicators.price,
      indicators, vix,
      volume: quote?.volume, avgVolume: 80000000,
      newsContext, calendarWarning,
      mtf, volumeAnalysis,
      preMarketContext, preMarket, futures,
      sectorContext, sectorData,
    });

    const confidenceScore = calcConfidenceScore({
      aiBaseConfidence: signal.confidence,
      vix, volumeAnalysis, mtf, sectorData,
      preMarket, futures,
      newsImpact: signal.news_impact,
      calendarWarning,
    });

    // Save signal to DB (system user — no user_id)
    const { rows: [savedSignal] } = await db.query(
      `INSERT INTO signals (symbol, signal, confidence, entry_price, target_price, stop_loss,
        reasoning, rsi, macd, vix, raw_response,
        timeframe_agreement, volume_label, rotation_signal, futures_bias, news_impact)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      ['SPY', signal.signal, confidenceScore.adjusted,
       signal.entry_price, signal.target_price, signal.stop_loss,
       signal.reasoning, indicators.rsi, indicators.macd, vix,
       JSON.stringify(signal),
       mtf?.agreement, volumeAnalysis?.label,
       sectorData?.rotation?.signal, futures?.bias, signal.news_impact]
    );

    // 6. Check all trading gates
    const gates = checkGates({
      signal: signal.signal,
      confidence: confidenceScore.adjusted,
      confidenceScore,
      vix,
      volumeAnalysis,
      mtf,
      calendarWarning,
      hasPosition: !!existingPosition,
    });

    console.log(`[AutoTrade ${runId}] Signal: ${signal.signal} | Confidence: ${confidenceScore.adjusted} | Gates: ${gates.passed ? 'PASSED' : 'FAILED'}`);

    if (!gates.passed) {
      await logScan({
        runId, status: 'GATES_FAILED',
        signal: signal.signal, confidence: confidenceScore.adjusted,
        reason: gates.reasons.join('; '),
        signalId: savedSignal.id,
      });
      return;
    }

    // 7. Calculate position size
    const price = quote?.price || indicators.price;
    const qty   = calcPositionSize(account, price, confidenceScore);

    if (qty <= 0) {
      await logScan({
        runId, status: 'ZERO_SHARES',
        signal: signal.signal, confidence: confidenceScore.adjusted,
        reason: 'Position size calculated to 0 shares',
        signalId: savedSignal.id,
      });
      return;
    }

    // 8. Place bracket order (entry + target + stop loss in one order)
    const side           = signal.signal === 'BUY' ? 'buy' : 'sell';
    const takeProfitPrice = parseFloat(signal.target_price.toFixed(2));
    const stopLossPrice   = parseFloat(signal.stop_loss.toFixed(2));
    const clientOrderId   = `spyai_${runId}`;

    console.log(`[AutoTrade ${runId}] Placing ${side.toUpperCase()} order: ${qty} shares @ ~$${price} | TP: $${takeProfitPrice} | SL: $${stopLossPrice}`);

    const order = await placeBracketOrder({
      symbol: 'SPY',
      qty,
      side,
      takeProfitPrice,
      stopLossPrice,
      clientOrderId,
    });

    // 9. Record auto-trade in database
    const { rows: [autoTrade] } = await db.query(
      `INSERT INTO auto_trades
        (run_id, signal_id, alpaca_order_id, symbol, side, qty,
         entry_price, target_price, stop_loss, confidence,
         position_size_pct, status, gates_passed, scan_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [runId, savedSignal.id, order.id, 'SPY', side.toUpperCase(), qty,
       price, takeProfitPrice, stopLossPrice, confidenceScore.adjusted,
       2.0 * (confidenceScore.positionSizePct / 100),
       'PENDING', true,
       `Placed bracket order. Confidence modifiers: ${confidenceScore.modifiers.map(m => `${m.label}(${m.value > 0 ? '+' : ''}${m.value})`).join(', ')}`]
    );

    await logScan({
      runId, status: 'EXECUTED',
      signal: signal.signal, confidence: confidenceScore.adjusted,
      reason: `Placed ${side.toUpperCase()} bracket order for ${qty} shares`,
      signalId: savedSignal.id, autoTradeId: autoTrade.id,
    });

    console.log(`[AutoTrade ${runId}] Order placed successfully. Order ID: ${order.id}`);

  } catch (err) {
    console.error(`[AutoTrade ${runId}] Error:`, err.message);
    await logScan({ runId, status: 'ERROR', reason: err.message });
  }
}

// ─── Position monitor — checks if TP or SL was hit ───────────────────────────
async function monitorPositions() {
  try {
    const clock = await getMarketStatus();
    if (!clock.isOpen) return;

    // Get all pending auto trades
    const { rows: pendingTrades } = await db.query(
      `SELECT * FROM auto_trades WHERE status IN ('PENDING', 'FILLED') ORDER BY created_at DESC LIMIT 20`
    );

    if (!pendingTrades.length) return;

    const positions = await getPositions();
    const spyPosition = positions.find(p => p.symbol === 'SPY');

    for (const trade of pendingTrades) {
      // Check if position still exists
      const stillOpen = !!spyPosition;

      if (!stillOpen && trade.status === 'FILLED') {
        // Position was closed — determine outcome
        const currentPrice = (await getSpySnapshot())?.price;
        const pnl = currentPrice
          ? (currentPrice - trade.entry_price) * trade.qty * (trade.side === 'BUY' ? 1 : -1)
          : null;
        const pnlPct = currentPrice
          ? (currentPrice - trade.entry_price) / trade.entry_price * 100 * (trade.side === 'BUY' ? 1 : -1)
          : null;

        const outcome = pnl > 0 ? 'WIN' : 'LOSS';

        await db.query(
          `UPDATE auto_trades SET status=$1, exit_price=$2, pnl=$3, pnl_pct=$4,
            outcome=$5, closed_at=NOW() WHERE id=$6`,
          ['CLOSED', currentPrice, pnl?.toFixed(4), pnlPct?.toFixed(4), outcome, trade.id]
        );

        console.log(`[Monitor] Auto-trade ${trade.run_id} closed — ${outcome} | P&L: $${pnl?.toFixed(2)}`);
      } else if (stillOpen && trade.status === 'PENDING') {
        // Mark as filled if position exists
        await db.query(
          `UPDATE auto_trades SET status='FILLED', filled_at=NOW() WHERE id=$1`,
          [trade.id]
        );
      }
    }
  } catch (err) {
    console.error('[Monitor] Error:', err.message);
  }
}

// ─── Scan logger ─────────────────────────────────────────────────────────────
async function logScan({ runId, status, signal, confidence, reason, signalId, autoTradeId }) {
  try {
    await db.query(
      `INSERT INTO auto_trade_scans (run_id, status, signal, confidence, reason, signal_id, auto_trade_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [runId, status, signal || null, confidence || null, reason, signalId || null, autoTradeId || null]
    );
  } catch (err) {
    console.error('[AutoTrade] Failed to log scan:', err.message);
  }
}

module.exports = { runAutoTrade, monitorPositions };
