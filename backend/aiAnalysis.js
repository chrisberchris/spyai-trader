const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateSignal({ price, indicators, vix, volume, avgVolume, newsContext, calendarWarning }) {
  const volumeStr = volume && avgVolume
    ? `${((volume / avgVolume) * 100).toFixed(0)}% of average`
    : 'N/A';

  const calendarAlert = calendarWarning
    ? `\n⚠ HIGH-IMPACT ECONOMIC EVENT IN NEXT 48 HOURS: ${calendarWarning}. Factor elevated uncertainty into your signal and confidence.`
    : '';

  const prompt = `You are an expert quantitative trading analyst for SPY (S&P 500 ETF).
You have access to REAL live market data, technical indicators, AND live news sentiment.
Your job is to synthesize ALL of this into the most accurate possible trading signal.

═══ TECHNICAL DATA ═══
- SPY Price: $${price}
- RSI (14): ${indicators.rsi ?? 'N/A'}
- MACD: ${indicators.macd ?? 'N/A'}
- SMA 50: ${indicators.sma50 ?? 'N/A'} (price is ${indicators.priceVsSMA50 ?? 'N/A'})
- SMA 200: ${indicators.sma200 ?? 'N/A'} (price is ${indicators.priceVsSMA200 ?? 'N/A'})
- MA Crossover: ${indicators.maCrossover ?? 'N/A'}
- Bollinger Bands: ${indicators.bollingerBands
    ? `Upper:${indicators.bollingerBands.upper} Mid:${indicators.bollingerBands.middle} Lower:${indicators.bollingerBands.lower} (price is ${indicators.priceVsBB})`
    : 'N/A'}
- ATR (14): ${indicators.atr ?? 'N/A'}
- EMA 20: ${indicators.ema20 ?? 'N/A'}
- VIX: ${vix ?? 'N/A'}
- Volume vs avg: ${volumeStr}

═══ LIVE NEWS SENTIMENT ═══
${newsContext || 'No news data available — base signal on technicals only.'}
${calendarAlert}

═══ INSTRUCTIONS ═══
1. Weigh BOTH technical signals AND news sentiment together.
2. If news sentiment strongly contradicts technicals, lower confidence and lean toward HOLD.
3. If news sentiment confirms technicals, increase confidence.
4. If a high-impact economic event is within 48 hours, reduce confidence by at least 10 points and note it in reasoning.
5. VIX above 25 = reduce confidence by 10 points and note elevated risk.
6. Explain reasoning referencing BOTH indicator values AND specific news context.

Return ONLY a valid JSON object, no markdown, no extra text:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": integer between 40 and 95,
  "reasoning": "3-5 sentences referencing both specific indicator values AND news context. Write for a beginner.",
  "news_impact": "CONFIRMING" or "CONTRADICTING" or "NEUTRAL",
  "news_summary": "one sentence summarising how news is affecting this signal",
  "calendar_warning": ${calendarWarning ? `"${calendarWarning}"` : 'null'},
  "entry_price": number,
  "target_price": number,
  "stop_loss": number,
  "risk_reward_ratio": number,
  "timeframe": "intraday" or "swing" or "longterm",
  "options": [
    {
      "type": "CALL" or "PUT",
      "strike": number,
      "expiry": "YYYY-MM-DD",
      "rationale": "one sentence referencing news or technical context"
    },
    {
      "type": "CALL" or "PUT",
      "strike": number,
      "expiry": "YYYY-MM-DD",
      "rationale": "one sentence"
    }
  ],
  "sentiment": [
    {
      "headline": "actual or paraphrased headline from the news data provided",
      "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL",
      "impact": "one sentence on how this affects SPY"
    },
    {
      "headline": "actual or paraphrased headline from the news data provided",
      "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL",
      "impact": "one sentence on how this affects SPY"
    },
    {
      "headline": "actual or paraphrased headline from the news data provided",
      "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL",
      "impact": "one sentence on how this affects SPY"
    }
  ],
  "key_levels": {
    "support": number,
    "resistance": number
  }
}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1200,
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
