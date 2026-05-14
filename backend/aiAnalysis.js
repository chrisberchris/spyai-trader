const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateSignal({
  price, indicators, vix, volume, avgVolume,
  newsContext, calendarWarning, mtf, volumeAnalysis
}) {
  const calendarAlert = calendarWarning
    ? `\n⚠ HIGH-IMPACT EVENT IN NEXT 48H: ${calendarWarning}. Reduce confidence accordingly.`
    : '';

  // Volume section
  const volumeSection = volumeAnalysis ? `
═══ VOLUME CONFIRMATION ═══
Current volume:    ${volumeAnalysis.current?.toLocaleString() ?? 'N/A'}
20-day avg volume: ${volumeAnalysis.avg20?.toLocaleString() ?? 'N/A'}
Volume vs avg:     ${volumeAnalysis.pct ?? 'N/A'}% (${volumeAnalysis.label?.replace('_', ' ') ?? 'N/A'})
Tradeable:         ${volumeAnalysis.tradeable ? 'YES' : 'NO — low volume, signal unreliable'}
Confidence modifier from volume: ${volumeAnalysis.confidenceModifier > 0 ? '+' : ''}${volumeAnalysis.confidenceModifier} points
${volumeAnalysis.warning ? `⚠ WARNING: ${volumeAnalysis.warning}` : ''}
` : `\n═══ VOLUME ═══\nVolume data unavailable.\n`;

  // Multi-timeframe section
  const mtfSection = mtf ? `
═══ MULTI-TIMEFRAME ANALYSIS ═══
${mtf.summary}
Timeframe agreement: ${mtf.agreement.replace('_', ' ')}
Confidence modifier from timeframe alignment: ${mtf.confidenceModifier > 0 ? '+' : ''}${mtf.confidenceModifier} points
Daily  — Bias: ${mtf.daily.bias  || 'N/A'} | RSI: ${mtf.daily.rsi  || 'N/A'} | MACD: ${mtf.daily.macd  || 'N/A'}
Hourly — Bias: ${mtf.hourly.bias || 'N/A'} | RSI: ${mtf.hourly.rsi || 'N/A'} | MACD: ${mtf.hourly.macd || 'N/A'}
15-min — Bias: ${mtf.m15.bias    || 'N/A'} | RSI: ${mtf.m15.rsi    || 'N/A'} | MACD: ${mtf.m15.macd    || 'N/A'}
` : '\n═══ MULTI-TIMEFRAME ═══\nNot available.\n';

  const prompt = `You are an expert quantitative trading analyst for SPY (S&P 500 ETF).
You have REAL live data across multiple timeframes, volume analysis, technical indicators, AND live news sentiment.
Synthesize ALL of this into the most accurate possible trading signal.

═══ TECHNICAL DATA (DAILY) ═══
- SPY Price: $${price}
- RSI (14): ${indicators.rsi ?? 'N/A'}
- MACD: ${indicators.macd ?? 'N/A'}
- SMA 50: ${indicators.sma50 ?? 'N/A'} (price is ${indicators.priceVsSMA50 ?? 'N/A'})
- SMA 200: ${indicators.sma200 ?? 'N/A'} (price is ${indicators.priceVsSMA200 ?? 'N/A'})
- MA Crossover: ${indicators.maCrossover ?? 'N/A'}
- Bollinger Bands: ${indicators.bollingerBands
    ? `U:${indicators.bollingerBands.upper} M:${indicators.bollingerBands.middle} L:${indicators.bollingerBands.lower} (price ${indicators.priceVsBB})`
    : 'N/A'}
- ATR (14): ${indicators.atr ?? 'N/A'}
- VIX: ${vix ?? 'N/A'}
${volumeSection}
${mtfSection}
═══ LIVE NEWS SENTIMENT ═══
${newsContext || 'No news data available.'}
${calendarAlert}

═══ SIGNAL RULES ═══
1. LOW or VERY_LOW volume = automatically reduce confidence by the volume confidenceModifier. Prefer HOLD on low-volume days unless other signals are exceptionally strong.
2. VERY_HIGH or HIGH volume on a directional move = strong confirmation, apply volume confidenceModifier bonus.
3. FULL timeframe agreement = +15 confidence. MIXED = -10.
4. News confirming technicals = increase confidence. News contradicting = decrease.
5. Calendar event within 48h = reduce confidence by 10 minimum.
6. VIX above 25 = reduce confidence by 10, note elevated risk.
7. Combine ALL modifiers: base confidence + volume modifier + MTF modifier + news adjustment.
8. Reasoning must mention volume level, timeframe agreement, AND news context. Write for a beginner.
9. If volume is LOW/VERY_LOW, explicitly warn in reasoning that this reduces signal reliability.

Return ONLY a valid JSON object, no markdown, no extra text:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": integer 40–95,
  "reasoning": "4-6 sentences covering: volume level, timeframe agreement, key indicators, news context. Plain English.",
  "volume_label": "${volumeAnalysis?.label ?? 'UNKNOWN'}",
  "volume_pct": ${volumeAnalysis?.pct ?? null},
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
    max_tokens: 1400,
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
