const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateSignal({
  price, indicators, vix, volume, avgVolume,
  newsContext, calendarWarning, mtf
}) {
  const volumeStr = volume && avgVolume
    ? `${((volume / avgVolume) * 100).toFixed(0)}% of average`
    : 'N/A';

  const calendarAlert = calendarWarning
    ? `\n⚠ HIGH-IMPACT EVENT IN NEXT 48H: ${calendarWarning}. Reduce confidence accordingly.`
    : '';

  // Build multi-timeframe section
  const mtfSection = mtf ? `
═══ MULTI-TIMEFRAME ANALYSIS ═══
${mtf.summary}

Timeframe agreement: ${mtf.agreement.replace('_', ' ')}
Confidence modifier from timeframe alignment: ${mtf.confidenceModifier > 0 ? '+' : ''}${mtf.confidenceModifier} points

Daily  — Bias: ${mtf.daily.bias  || 'N/A'} | RSI: ${mtf.daily.rsi  || 'N/A'} | MACD: ${mtf.daily.macd  || 'N/A'} | Price vs SMA20: ${mtf.daily.priceVsSMA20  || 'N/A'}
Hourly — Bias: ${mtf.hourly.bias || 'N/A'} | RSI: ${mtf.hourly.rsi || 'N/A'} | MACD: ${mtf.hourly.macd || 'N/A'} | Price vs SMA20: ${mtf.hourly.priceVsSMA20 || 'N/A'}
15-min — Bias: ${mtf.m15.bias    || 'N/A'} | RSI: ${mtf.m15.rsi    || 'N/A'} | MACD: ${mtf.m15.macd    || 'N/A'} | Price vs SMA20: ${mtf.m15.priceVsSMA20    || 'N/A'}
` : '\n═══ MULTI-TIMEFRAME ═══\nNot available — using daily only.\n';

  const prompt = `You are an expert quantitative trading analyst for SPY (S&P 500 ETF).
You have access to REAL live market data across MULTIPLE TIMEFRAMES, technical indicators, AND live news sentiment.
Your job is to synthesize ALL of this into the most accurate possible trading signal.

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
- Volume vs avg: ${volumeStr}
${mtfSection}
═══ LIVE NEWS SENTIMENT ═══
${newsContext || 'No news data available.'}
${calendarAlert}

═══ SIGNAL RULES ═══
1. FULL agreement across all 3 timeframes = high conviction, max confidence boost +15.
2. MIXED timeframes = conflicting signals, reduce confidence by 10, lean HOLD unless news strongly confirms.
3. News sentiment contradicts technicals = reduce confidence, note contradiction in reasoning.
4. News confirms technicals = increase confidence.
5. High-impact economic event within 48h = reduce confidence by 10 minimum, always note it.
6. VIX above 25 = reduce confidence by 10, note elevated volatility.
7. Apply the confidenceModifier from multi-timeframe alignment to your base confidence.
8. Write reasoning that mentions ALL THREE timeframes and news context — beginners need to understand why.

Return ONLY a valid JSON object, no markdown, no extra text:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": integer 40–95 (apply mtf confidenceModifier to your base),
  "reasoning": "4-6 sentences covering daily indicators, hourly/15min confirmation or conflict, AND news context. Plain English for a beginner.",
  "timeframe_agreement": "${mtf?.agreement || 'UNKNOWN'}",
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
