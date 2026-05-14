const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateSignal({
  price, indicators, vix, volume, avgVolume,
  newsContext, calendarWarning, mtf, volumeAnalysis,
  preMarketContext, preMarket, futures
}) {
  const calendarAlert = calendarWarning
    ? `\n⚠ HIGH-IMPACT EVENT IN NEXT 48H: ${calendarWarning}. Reduce confidence accordingly.`
    : '';

  const volumeSection = volumeAnalysis ? `
═══ VOLUME CONFIRMATION ═══
Current volume:    ${volumeAnalysis.current?.toLocaleString() ?? 'N/A'}
20-day avg volume: ${volumeAnalysis.avg20?.toLocaleString() ?? 'N/A'}
Volume vs avg:     ${volumeAnalysis.pct ?? 'N/A'}% (${volumeAnalysis.label?.replace('_', ' ') ?? 'N/A'})
Tradeable:         ${volumeAnalysis.tradeable ? 'YES' : 'NO — low volume'}
Confidence modifier: ${volumeAnalysis.confidenceModifier > 0 ? '+' : ''}${volumeAnalysis.confidenceModifier} points
${volumeAnalysis.warning ? `⚠ ${volumeAnalysis.warning}` : ''}
` : '';

  const mtfSection = mtf ? `
═══ MULTI-TIMEFRAME ANALYSIS ═══
${mtf.summary}
Agreement: ${mtf.agreement.replace('_', ' ')} | Confidence modifier: ${mtf.confidenceModifier > 0 ? '+' : ''}${mtf.confidenceModifier} points
Daily  — ${mtf.daily.bias  || 'N/A'} | RSI: ${mtf.daily.rsi  || 'N/A'} | MACD: ${mtf.daily.macd  || 'N/A'}
Hourly — ${mtf.hourly.bias || 'N/A'} | RSI: ${mtf.hourly.rsi || 'N/A'} | MACD: ${mtf.hourly.macd || 'N/A'}
15-min — ${mtf.m15.bias    || 'N/A'} | RSI: ${mtf.m15.rsi    || 'N/A'} | MACD: ${mtf.m15.macd    || 'N/A'}
` : '';

  const preMarketSection = preMarketContext ? `
═══ PRE-MARKET & FUTURES ═══
${preMarketContext}
` : '';

  // Gap confidence modifier
  let gapModifier = 0;
  let gapWarning = '';
  if (preMarket?.gapType) {
    if (preMarket.gapType === 'GAP_UP_LARGE' || preMarket.gapType === 'GAP_DOWN_LARGE') {
      gapModifier = -10;
      gapWarning = `Large gap detected (${preMarket.gapPct}%). Large gaps increase risk — reduce position size.`;
    } else if (preMarket.gapType === 'GAP_UP' || preMarket.gapType === 'GAP_DOWN') {
      gapModifier = -5;
    }
  }

  // Futures alignment modifier
  let futuresModifier = 0;
  if (futures?.bias === 'BULLISH') futuresModifier = 5;
  else if (futures?.bias === 'BEARISH') futuresModifier = -5;

  const prompt = `You are an expert quantitative trading analyst for SPY (S&P 500 ETF).
You have REAL live data: pre-market prices, ES futures, multi-timeframe technicals, volume, AND live news.
Synthesize ALL of this for the most accurate signal possible.

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
- ATR (14): ${indicators.atr ?? 'N/A'}
- VIX: ${vix ?? 'N/A'}
${preMarketSection}
${volumeSection}
${mtfSection}
═══ LIVE NEWS SENTIMENT ═══
${newsContext || 'No news data available.'}
${calendarAlert}

═══ SIGNAL RULES ═══
1. Pre-market direction + futures bias = leading indicator. If ES futures are strongly bearish, be cautious on BUY signals even if technicals look bullish.
2. Large gap (>1%): reduce confidence by 10 — gaps create unpredictable opening moves. Note the gap in reasoning.
3. Futures confirming technicals: +5 confidence. Contradicting: -5.
4. Low volume: reduce confidence, prefer HOLD.
5. Mixed timeframes: -10 confidence.
6. Full timeframe agreement: +15 confidence.
7. News contradicting technicals: lower confidence.
8. Calendar event within 48h: -10 confidence minimum.
9. VIX > 25: -10 confidence.
10. Apply ALL modifiers to your base confidence score.
${gapWarning ? `11. ⚠ GAP WARNING: ${gapWarning}` : ''}
11. Reasoning must reference pre-market/futures, volume, timeframe agreement, AND news. Write for a beginner.

Return ONLY a valid JSON object, no markdown:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": integer 40–95,
  "reasoning": "4-6 sentences covering pre-market/futures direction, volume, timeframe agreement, key indicators, news. Plain English for a beginner.",
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
    { "type": "CALL" or "PUT", "strike": number, "expiry": "YYYY-MM-DD", "rationale": "one sentence" },
    { "type": "CALL" or "PUT", "strike": number, "expiry": "YYYY-MM-DD", "rationale": "one sentence" }
  ],
  "sentiment": [
    { "headline": "headline from news data", "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL", "impact": "one sentence" },
    { "headline": "headline from news data", "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL", "impact": "one sentence" },
    { "headline": "headline from news data", "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL", "impact": "one sentence" }
  ],
  "key_levels": { "support": number, "resistance": number }
}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = message.content
    .map(b => b.text || '')
    .join('')
    .replace(/```json|```/g, '')
    .trim();

  return JSON.parse(text);
}

module.exports = { generateSignal };
