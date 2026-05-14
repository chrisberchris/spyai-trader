const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateSignal({
  price, indicators, vix, volume, avgVolume,
  newsContext, calendarWarning, mtf, volumeAnalysis,
  preMarketContext, preMarket, futures,
  sectorContext, sectorData
}) {
  const calendarAlert = calendarWarning
    ? `\n⚠ HIGH-IMPACT EVENT IN NEXT 48H: ${calendarWarning}. Reduce confidence accordingly.`
    : '';

  const volumeSection = volumeAnalysis ? `
═══ VOLUME CONFIRMATION ═══
Volume vs 20-day avg: ${volumeAnalysis.pct ?? 'N/A'}% (${volumeAnalysis.label?.replace('_', ' ') ?? 'N/A'})
Tradeable: ${volumeAnalysis.tradeable ? 'YES' : 'NO — low volume'}
Confidence modifier: ${volumeAnalysis.confidenceModifier > 0 ? '+' : ''}${volumeAnalysis.confidenceModifier} points
${volumeAnalysis.warning ? `⚠ ${volumeAnalysis.warning}` : ''}` : '';

  const mtfSection = mtf ? `
═══ MULTI-TIMEFRAME ANALYSIS ═══
Agreement: ${mtf.agreement.replace('_', ' ')} | Modifier: ${mtf.confidenceModifier > 0 ? '+' : ''}${mtf.confidenceModifier} pts
Daily  — ${mtf.daily.bias  || 'N/A'} | RSI: ${mtf.daily.rsi  || 'N/A'} | MACD: ${mtf.daily.macd  || 'N/A'}
Hourly — ${mtf.hourly.bias || 'N/A'} | RSI: ${mtf.hourly.rsi || 'N/A'} | MACD: ${mtf.hourly.macd || 'N/A'}
15-min — ${mtf.m15.bias    || 'N/A'} | RSI: ${mtf.m15.rsi    || 'N/A'} | MACD: ${mtf.m15.macd    || 'N/A'}` : '';

  const preMarketSection = preMarketContext ? `
═══ PRE-MARKET & FUTURES ═══
${preMarketContext}` : '';

  const sectorSection = sectorContext ? `
═══ SECTOR ROTATION ═══
${sectorContext}` : '';

  // Gap modifier
  let gapWarning = '';
  if (preMarket?.gapType === 'GAP_UP_LARGE' || preMarket?.gapType === 'GAP_DOWN_LARGE') {
    gapWarning = `Large gap detected (${preMarket.gapPct}%). Reduce position size.`;
  }

  const prompt = `You are an expert quantitative trading analyst for SPY (S&P 500 ETF).
You have REAL live data: sector rotation, pre-market, futures, multi-timeframe technicals, volume, AND news.
Synthesize ALL data sources into the most accurate signal possible.

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
${sectorSection}
${volumeSection}
${mtfSection}
═══ LIVE NEWS SENTIMENT ═══
${newsContext || 'No news data available.'}
${calendarAlert}

═══ SIGNAL RULES ═══
1. RISK_ON rotation (offensive sectors leading) = confirms BUY signals, +10 confidence.
2. RISK_OFF rotation (defensive sectors leading) = warns against BUY signals, -10 confidence.
3. Broad market breadth (>70% sectors positive) = confirms bullish signals.
4. Narrow breadth (<30% positive) = confirms bearish signals.
5. Large gap: -10 confidence, reduce position size.
6. Futures direction confirms technicals: +5. Contradicts: -5.
7. Low volume: prefer HOLD, reduce confidence.
8. Mixed MTF: -10. Full agreement: +15.
9. News contradicting technicals: lower confidence.
10. Calendar event within 48h: -10 minimum.
11. VIX > 25: -10.
12. Apply ALL modifiers. Reasoning must mention sector rotation and breadth. Write for a beginner.
${gapWarning ? `13. ⚠ GAP WARNING: ${gapWarning}` : ''}

Return ONLY a valid JSON object, no markdown:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": integer 40–95,
  "reasoning": "4-6 sentences covering sector rotation, pre-market/futures, volume, timeframe agreement, key indicators, and news. Plain English.",
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
