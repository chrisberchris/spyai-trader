// Pure JS technical indicator calculations — no external lib needed

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

function calcEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return parseFloat(ema.toFixed(4));
}

function calcSMA(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b, 0) / period).toFixed(4));
}

function calcMACD(closes) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (!ema12 || !ema26) return { macd: null, signal: null, histogram: null };
  const macd = parseFloat((ema12 - ema26).toFixed(4));
  return { macd, signal: null, histogram: null };
}

function calcBollingerBands(closes, period = 20) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: parseFloat((sma + 2 * std).toFixed(4)),
    middle: parseFloat(sma.toFixed(4)),
    lower: parseFloat((sma - 2 * std).toFixed(4))
  };
}

function calcATR(highs, lows, closes, period = 14) {
  if (closes.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  return parseFloat((trs.slice(-period).reduce((a, b) => a + b, 0) / period).toFixed(4));
}

function calcAllIndicators(bars) {
  const closes = bars.map(b => b.c);
  const highs = bars.map(b => b.h);
  const lows = bars.map(b => b.l);
  const current = closes[closes.length - 1];

  const rsi = calcRSI(closes);
  const { macd } = calcMACD(closes);
  const sma50 = calcSMA(closes, 50);
  const sma200 = calcSMA(closes, 200);
  const bb = calcBollingerBands(closes);
  const atr = calcATR(highs, lows, closes);
  const ema20 = calcEMA(closes, 20);

  return {
    price: parseFloat(current.toFixed(4)),
    rsi,
    macd,
    sma50,
    sma200,
    maCrossover: sma50 && sma200 ? (sma50 > sma200 ? 'golden' : 'death') : null,
    bollingerBands: bb,
    atr,
    ema20,
    priceVsBB: bb ? (current > bb.upper ? 'above' : current < bb.lower ? 'below' : 'inside') : null,
    priceVsSMA50: sma50 ? (current > sma50 ? 'above' : 'below') : null,
    priceVsSMA200: sma200 ? (current > sma200 ? 'above' : 'below') : null,
  };
}

module.exports = { calcRSI, calcEMA, calcSMA, calcMACD, calcBollingerBands, calcATR, calcAllIndicators };
