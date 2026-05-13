const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateSignal({ price, indicators, vix, volume, avgVolume }) {
  const prompt = `You are an expert quantitative trading analyst for SPY (S&P 500 ETF).

Current real market data:
- SPY Price: $${price}
- RSI (14): ${indicators.rsi ?? 'N/A'}
- MACD: ${indicators.macd ?? 'N/A'}
- SMA 50: ${indicators.sma50 ?? 'N/A'} (price is ${indicators.priceVsSMA50 ?? 'N/A'})
- SMA 200: ${indicators.sma200 ?? 'N/A'} (price is ${indicators.priceVsSMA200 ?? 'N/A'})
- MA Cross: ${indicators.maCrossover ?? 'N/A'}
- Bollinger Bands: ${indicators.bollingerBands ? `U:${indicators.bollingerBands.upper} M:${indicators.bollingerBands.middle} L:${indicators.bollingerBands.lower} (price is ${indicators.priceVsBB})` : 'N/A'}
- ATR (14): ${indicators.atr ?? 'N/A'}
- VIX: ${vix ?? 'N/A'}
- Volume vs avg: ${volume && avgVolume ? ((volume / avgVolume) * 100).toFixed(0) + '%' : 'N/A'}

Analyze all indicators and return ONLY a valid JSON object, no markdown, no extra text:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": integer between 50 and 95,
  "reasoning": "3-4 sentences in plain English explaining why, mentioning specific indicator values",
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
      "rationale": "one sentence"
    },
    {
      "type": "CALL" or "PUT",
      "strike": number,
      "expiry": "YYYY-MM-DD",
      "rationale": "one sentence"
    }
  ],
  "sentiment": [
    { "headline": "realistic SPY-relevant macro news headline", "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL", "impact": "brief note on market impact" },
    { "headline": "realistic SPY-relevant macro news headline", "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL", "impact": "brief note on market impact" },
    { "headline": "realistic SPY-relevant macro news headline", "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL", "impact": "brief note on market impact" }
  ],
  "key_levels": {
    "support": number,
    "resistance": number
  }
}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = message.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

module.exports = { generateSignal };
