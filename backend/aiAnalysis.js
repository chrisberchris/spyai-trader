const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Retry helper — retries on 529 overloaded with exponential backoff
async function callWithRetry(fn, retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isOverloaded = err?.status === 529
        || err?.message?.includes('overloaded')
        || err?.message?.includes('529');
      if (isOverloaded && attempt < retries) {
        const wait = delayMs * attempt; // 3s, 6s, 9s, 12s
        console.log(`Anthropic overloaded — retrying in ${wait}ms (attempt ${attempt}/${retries})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}

async function generateSignal({
  price, indicators, vix, volume, avgVolume,
  newsContext, calendarWarning, mtf, volumeAnalysis,
  preMarketContext, preMarket, futures,
  sectorContext, sectorData,
  optionsFlowContext, optionsFlow
}) {
  const calendarAlert = calendarWarning
    ? `\n⚠ HIGH-IMPACT EVENT IN NEXT 48H: ${calendarWarning}. Reduce confidence accordingly.`
    : '';

  const volumeSection = volumeAnalysis ? `
═══ VOLUME CONFIRMATION ═══
Volume vs 20-day avg: ${volumeAnalysis.pct ?? 'N/A'}% (${volumeAnalysis.label?.replace('_',' ') ?? 'N/A'})
Tradeable: ${volumeAnalysis.tradeable ? 'YES' : 'NO — low volume'}
Modifier: ${volumeAnalysis.confidenceModifier > 0 ? '+' : ''}${volumeAnalysis.confidenceModifier} pts
${volumeAnalysis.warning ? `⚠ ${volumeAnalysis.warning}` : ''}` : '';

  const mtfSection = mtf ? `
═══ MULTI-TIMEFRAME ANALYSIS ═══
Agreement: ${mtf.agreement.replace('_',' ')} | Modifier: ${mtf.confidenceModifier > 0 ? '+' : ''}${mtf.confidenceModifier} pts
Daily  — ${mtf.daily.bias  || 'N/A'} | RSI: ${mtf.daily.rsi  || 'N/A'} | MACD: ${mtf.daily.macd  || 'N/A'}
Hourly — ${mtf.hourly.bias || 'N/A'} | RSI: ${mtf.hourly.rsi || 'N/A'} | MACD: ${mtf.hourly.macd || 'N/A'}
15-min — ${mtf.m15.bias    || 'N/A'} | RSI: ${mtf.m15.rsi    || 'N/A'} | MACD: ${mtf.m15.macd    || 'N/A'}` : '';

  const preMarketSection = preMarketContext ? `
═══ PRE-MARKET & FUTURES ═══
${preMarketContext}` : '';

  const sectorSection = sectorContext ? `
═══ SECTOR ROTATION ═══
${sectorContext}` : '';

  const optionsSection = optionsFlowContext ? `
═══ OPTIONS FLOW (SMART MONEY) ═══
${optionsFlowContext}` : '';

  const gapWarning = (preMarket?.gapType === 'GAP_UP_LARGE' || preMarket?.gapType === 'GAP_DOWN_LARGE')
    ? `⚠ Large gap (${preMarket.gapPct}%) — reduce position size.`
    : '';

  const prompt = `You are an expert quantitative trading analyst for SPY (S&P 500 ETF).
You have REAL live data across ALL major signal sources: options flow (smart money), sector rotation, pre-market, futures, multi-timeframe technicals, volume, AND news.
This is a complete institutional-grade analysis. Synthesize everything.

═══ TECHNICAL DATA (DAILY) ═══
- SPY Price: $${price}
- RSI (14): ${indicators.rsi ?? 'N/A'}
- MACD: ${indicators.macd ?? 'N/A'}
- SMA 50: ${indicators.sma50 ?? 'N/A'} (price ${indicators.priceVsSMA50 ?? 'N/A'})
- SMA 200: ${indicators.sma200 ?? 'N/A'} (price ${indicators.priceVsSMA200 ?? 'N/A'})
- MA Crossover: ${indicators.maCrossover ?? 'N/A'}
- Bollinger Bands: ${indicators.bollingerBands
    ? `U:${indicators.bollingerBands.upper} M:${indicators.bollingerBands.middle} L:${indicators.bollingerBands.lower} (${indicators.priceVsBB})`
    : 'N/A'}
- ATR: ${indicators.atr ?? 'N/A'} | VIX: ${vix ?? 'N/A'}
${preMarketSection}
${optionsSection}
${sectorSection}
${volumeSection}
${mtfSection}
═══ LIVE NEWS SENTIMENT ═══
${newsContext || 'No news data available.'}
${calendarAlert}

═══ SIGNAL RULES ═══
1. OPTIONS FLOW IS THE STRONGEST SIGNAL — institutional money is "smart money". Unusual put buying = bearish warning even if technicals look bullish. Unusual call buying = bullish confirmation.
2. High put/call ratio (>1.5) = market fear, reduce confidence on BUY signals.
3. Low put/call ratio (<0.7) = complacency or bullish positioning.
4. RISK_ON sector rotation confirms BUY signals (+10). RISK_OFF warns against (+10 bearish).
5. Large gap: -10 confidence, warn about position sizing.
6. Full MTF agreement: +15. Mixed: -10.
7. Low volume: prefer HOLD.
8. News contradicting: lower confidence.
9. Calendar event: -10 minimum.
10. VIX > 25: -10.
11. Reasoning MUST mention options flow (put/call ratio, any unusual activity), sector rotation, and at least 2 technical indicators. Write for a beginner — explain what put/call ratio means simply.
${gapWarning}

Return ONLY a valid JSON object, no markdown:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": integer 40–95,
  "reasoning": "5-7 sentences: start with options flow insight, then sector rotation, then key technicals, then news/calendar. Plain English for a beginner.",
  "options_flow_summary": "one sentence explaining what the options market is signaling",
  "put_call_ratio": ${optionsFlow?.putCallRatio ?? null},
  "flow_bias": "${optionsFlow?.flowBias ?? 'NEUTRAL'}",
  "rotation_signal": "${sectorData?.rotation?.signal ?? 'NEUTRAL'}",
  "breadth_pct": ${sectorData?.rotation?.breadthPct ?? null},
  "gap_type": "${preMarket?.gapType ?? 'NONE'}",
  "gap_pct": ${preMarket?.gapPct ?? null},
  "futures_bias": "${futures?.bias ?? 'NEUTRAL'}",
  "volume_label": "${volumeAnalysis?.label ?? 'UNKNOWN'}",
  "volume_tradeable": ${volumeAnalysis?.tradeable ?? true},
  "timeframe_agreement": "${mtf?.agreement ?? 'UNKNOWN'}",
  "news_impact": "CONFIRMING" or "CONTRADICTING" or "NEUTRAL",
  "news_summary": "one sentence on how news affects this signal",
  "calendar_warning": ${calendarWarning ? `"${calendarWarning}"` : 'null'},
  "entry_price": number,
  "target_price": number,
  "stop_loss": number,
  "risk_reward_ratio": number,
  "timeframe": "intraday" or "swing" or "longterm",
  "options": [
    { "type": "CALL" or "PUT", "strike": number, "expiry": "YYYY-MM-DD", "rationale": "one sentence referencing options flow if relevant" },
    { "type": "CALL" or "PUT", "strike": number, "expiry": "YYYY-MM-DD", "rationale": "one sentence" }
  ],
  "sentiment": [
    { "headline": "headline from news data", "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL", "impact": "one sentence" },
    { "headline": "headline from news data", "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL", "impact": "one sentence" },
    { "headline": "headline from news data", "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL", "impact": "one sentence" }
  ],
  "key_levels": { "support": number, "resistance": number }
}`;

  const message = await callWithRetry(() =>
    client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1600,
      messages: [{ role: 'user', content: prompt }]
    })
  );

  const text = message.content
    .map(b => b.text || '')
    .join('')
    .replace(/```json|```/g, '')
    .trim();

  return JSON.parse(text);
}

module.exports = { generateSignal };
