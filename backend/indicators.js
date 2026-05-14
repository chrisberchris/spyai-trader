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

// Multi-timeframe analysis — returns indicators for a given bar set
// plus an agreement score across timeframes
function calcTimeframeIndicators(bars, label) {
  if (!bars || bars.length < 20) return { label, sufficient: false };
  const closes = bars.map(b => b.c);
  const highs   = bars.map(b => b.h);
  const lows    = bars.map(b => b.l);
  const current = closes[closes.length - 1];

  const rsi  = calcRSI(closes);
  const { macd } = calcMACD(closes);
  const sma20 = calcSMA(closes, Math.min(20, closes.length));
  const sma50 = calcSMA(closes, Math.min(50, closes.length));
  const bb    = calcBollingerBands(closes, Math.min(20, closes.length));
  const atr   = calcATR(highs, lows, closes, Math.min(14, closes.length - 1));
  const ema9  = calcEMA(closes, Math.min(9, closes.length));

  // Derive bias: +1 bullish, -1 bearish, 0 neutral for each signal
  const signals = [
    rsi !== null ? (rsi < 45 ? 1 : rsi > 60 ? -1 : 0) : 0,
    macd !== null ? (macd > 0.1 ? 1 : macd < -0.1 ? -1 : 0) : 0,
    sma20 && sma50 ? (sma20 > sma50 ? 1 : -1) : 0,
    bb ? (current < bb.lower ? 1 : current > bb.upper ? -1 : 0) : 0,
    ema9 ? (current > ema9 ? 1 : -1) : 0,
  ];

  const score = signals.reduce((a, b) => a + b, 0);
  const bias  = score >= 2 ? 'BULLISH' : score <= -2 ? 'BEARISH' : 'NEUTRAL';

  return {
    label,
    sufficient: true,
    price: parseFloat(current.toFixed(4)),
    rsi,
    macd,
    sma20,
    sma50,
    bb,
    atr,
    ema9,
    bias,
    score,
    signals,
    priceVsSMA20: sma20 ? (current > sma20 ? 'above' : 'below') : null,
    priceVsBB: bb ? (current > bb.upper ? 'above' : current < bb.lower ? 'below' : 'inside') : null,
  };
}

// Combine daily + hourly + 15min into one multi-timeframe summary
function calcMultiTimeframe(dailyBars, hourlyBars, bars15m) {
  const daily  = calcTimeframeIndicators(dailyBars,  'daily');
  const hourly = calcTimeframeIndicators(hourlyBars, 'hourly');
  const m15    = calcTimeframeIndicators(bars15m,    '15min');

  // Agreement: how many timeframes share the same bias
  const biases = [daily, hourly, m15].filter(t => t.sufficient).map(t => t.bias);
  const bullCount = biases.filter(b => b === 'BULLISH').length;
  const bearCount = biases.filter(b => b === 'BEARISH').length;
  const agreement = bullCount === biases.length ? 'FULL_BULL'
    : bearCount === biases.length ? 'FULL_BEAR'
    : bullCount >= 2 ? 'MOSTLY_BULL'
    : bearCount >= 2 ? 'MOSTLY_BEAR'
    : 'MIXED';

  const agreementScore = Math.round(
    [daily, hourly, m15].filter(t => t.sufficient).reduce((a, t) => a + Math.abs(t.score), 0) /
    Math.max([daily, hourly, m15].filter(t => t.sufficient).length, 1)
  );

  // Confidence modifier based on agreement
  const confidenceModifier =
    agreement === 'FULL_BULL' || agreement === 'FULL_BEAR'   ?  15 :
    agreement === 'MOSTLY_BULL' || agreement === 'MOSTLY_BEAR' ?  5 :
    -10; // mixed = lower confidence

  return {
    daily,
    hourly,
    m15,
    agreement,
    agreementScore,
    confidenceModifier,
    summary: buildMTFSummary(daily, hourly, m15, agreement),
  };
}

function buildMTFSummary(daily, hourly, m15, agreement) {
  const lines = [];
  if (daily.sufficient)  lines.push(`Daily: ${daily.bias} (RSI ${daily.rsi}, MACD ${daily.macd})`);
  if (hourly.sufficient) lines.push(`Hourly: ${hourly.bias} (RSI ${hourly.rsi}, MACD ${hourly.macd})`);
  if (m15.sufficient)    lines.push(`15-min: ${m15.bias} (RSI ${m15.rsi}, MACD ${m15.macd})`);
  lines.push(`Timeframe agreement: ${agreement.replace('_', ' ')}`);
  return lines.join('\n');
}

// Volume confirmation analysis
// Returns volume context including 20-day average, ratio, and a trading recommendation
function calcVolumeAnalysis(bars, currentVolume) {
  if (!bars || bars.length < 20) return null;

  // 20-day average volume from historical bars
  const recentBars = bars.slice(-20);
  const avgVolume20 = Math.round(
    recentBars.reduce((sum, b) => sum + (b.v || 0), 0) / recentBars.length
  );

  // 5-day average (shorter-term baseline)
  const avgVolume5 = Math.round(
    bars.slice(-5).reduce((sum, b) => sum + (b.v || 0), 0) / 5
  );

  const volume = currentVolume || bars[bars.length - 1].v || 0;
  const ratio20 = avgVolume20 > 0 ? parseFloat((volume / avgVolume20).toFixed(2)) : null;
  const ratio5  = avgVolume5  > 0 ? parseFloat((volume / avgVolume5).toFixed(2))  : null;

  // Classification
  let label, confidenceModifier, tradeable;
  if (ratio20 === null) {
    label = 'UNKNOWN'; confidenceModifier = 0; tradeable = true;
  } else if (ratio20 >= 1.5) {
    label = 'VERY_HIGH'; confidenceModifier = 10; tradeable = true;
  } else if (ratio20 >= 1.2) {
    label = 'HIGH';      confidenceModifier = 5;  tradeable = true;
  } else if (ratio20 >= 0.8) {
    label = 'NORMAL';    confidenceModifier = 0;  tradeable = true;
  } else if (ratio20 >= 0.5) {
    label = 'LOW';       confidenceModifier = -8; tradeable = false;
  } else {
    label = 'VERY_LOW';  confidenceModifier = -15; tradeable = false;
  }

  const pct = ratio20 !== null ? Math.round(ratio20 * 100) : null;

  return {
    current: volume,
    avg20: avgVolume20,
    avg5: avgVolume5,
    ratio20,
    ratio5,
    label,
    pct,                    // e.g. 142 means 142% of average
    confidenceModifier,
    tradeable,              // false = low volume, signal less reliable
    warning: !tradeable
      ? `Volume is only ${pct}% of its 20-day average. Low-volume moves are unreliable — confidence reduced.`
      : null,
    summary: `Current volume is ${pct}% of 20-day average (${label.replace('_', ' ').toLowerCase()})`
  };
}

// Auto-scaling confidence score
// Takes all available context and computes a final adjusted confidence
// with a full breakdown of every modifier applied
function calcConfidenceScore({ aiBaseConfidence, vix, volumeAnalysis, mtf, sectorData, preMarket, futures, newsImpact, calendarWarning }) {
  const base = Math.max(40, Math.min(95, aiBaseConfidence || 65));
  const modifiers = [];

  // VIX modifier
  if (vix !== null && vix !== undefined) {
    if      (vix > 35) { modifiers.push({ label: 'VIX extreme (>35)',   value: -15, category: 'risk' }); }
    else if (vix > 25) { modifiers.push({ label: 'VIX elevated (>25)',  value: -10, category: 'risk' }); }
    else if (vix > 20) { modifiers.push({ label: 'VIX moderate (>20)',  value: -5,  category: 'risk' }); }
    else if (vix < 14) { modifiers.push({ label: 'VIX low (<14)',       value: +5,  category: 'risk' }); }
  }

  // Volume modifier
  if (volumeAnalysis) {
    if      (volumeAnalysis.label === 'VERY_HIGH') modifiers.push({ label: 'Volume very high',  value: +10, category: 'volume' });
    else if (volumeAnalysis.label === 'HIGH')      modifiers.push({ label: 'Volume high',       value: +5,  category: 'volume' });
    else if (volumeAnalysis.label === 'LOW')       modifiers.push({ label: 'Volume low',        value: -8,  category: 'volume' });
    else if (volumeAnalysis.label === 'VERY_LOW')  modifiers.push({ label: 'Volume very low',   value: -15, category: 'volume' });
  }

  // Multi-timeframe modifier
  if (mtf) {
    if      (mtf.agreement === 'FULL_BULL' || mtf.agreement === 'FULL_BEAR')     modifiers.push({ label: 'Full MTF agreement',   value: +15, category: 'mtf' });
    else if (mtf.agreement === 'MOSTLY_BULL' || mtf.agreement === 'MOSTLY_BEAR') modifiers.push({ label: 'Partial MTF agreement', value: +5,  category: 'mtf' });
    else if (mtf.agreement === 'MIXED')                                           modifiers.push({ label: 'Mixed MTF signals',    value: -10, category: 'mtf' });
  }

  // Sector rotation modifier
  if (sectorData?.rotation) {
    const r = sectorData.rotation;
    if      (r.signal === 'RISK_ON')       modifiers.push({ label: 'Sector rotation: Risk-On',       value: +10, category: 'sectors' });
    else if (r.signal === 'MILD_RISK_ON')  modifiers.push({ label: 'Sector rotation: Mild Risk-On',  value: +5,  category: 'sectors' });
    else if (r.signal === 'MILD_RISK_OFF') modifiers.push({ label: 'Sector rotation: Mild Risk-Off', value: -5,  category: 'sectors' });
    else if (r.signal === 'RISK_OFF')      modifiers.push({ label: 'Sector rotation: Risk-Off',      value: -10, category: 'sectors' });

    // Breadth modifier
    if      (r.breadthPct >= 80) modifiers.push({ label: 'Broad market breadth (>80%)', value: +5,  category: 'sectors' });
    else if (r.breadthPct <= 20) modifiers.push({ label: 'Narrow market breadth (<20%)', value: -5, category: 'sectors' });
  }

  // Gap modifier
  if (preMarket?.gapType) {
    if      (preMarket.gapType === 'GAP_UP_LARGE' || preMarket.gapType === 'GAP_DOWN_LARGE')
      modifiers.push({ label: `Large gap (${preMarket.gapPct}%)`, value: -10, category: 'premarket' });
    else if (preMarket.gapType === 'GAP_UP' || preMarket.gapType === 'GAP_DOWN')
      modifiers.push({ label: `Gap (${preMarket.gapPct}%)`,       value: -5,  category: 'premarket' });
  }

  // Futures alignment
  if (futures?.bias) {
    if      (futures.bias === 'BULLISH') modifiers.push({ label: 'Futures bullish',  value: +5,  category: 'premarket' });
    else if (futures.bias === 'BEARISH') modifiers.push({ label: 'Futures bearish',  value: -5,  category: 'premarket' });
  }

  // News modifier
  if (newsImpact) {
    if      (newsImpact === 'CONFIRMING')    modifiers.push({ label: 'News confirms signal',    value: +8,  category: 'news' });
    else if (newsImpact === 'CONTRADICTING') modifiers.push({ label: 'News contradicts signal', value: -8,  category: 'news' });
  }

  // Calendar warning
  if (calendarWarning) {
    modifiers.push({ label: 'High-impact event within 48h', value: -10, category: 'calendar' });
  }

  // Apply all modifiers
  const totalModifier = modifiers.reduce((sum, m) => sum + m.value, 0);
  const adjusted = Math.max(40, Math.min(95, base + totalModifier));

  // Position size recommendation based on final confidence
  let positionSize;
  if      (adjusted >= 85) positionSize = 'FULL';     // 100% of planned position
  else if (adjusted >= 75) positionSize = 'STANDARD'; // 75%
  else if (adjusted >= 65) positionSize = 'REDUCED';  // 50%
  else if (adjusted >= 55) positionSize = 'SMALL';    // 25%
  else                     positionSize = 'AVOID';    // skip trade

  return {
    base,
    adjusted,
    totalModifier,
    modifiers,
    positionSize,
    positionSizePct: positionSize === 'FULL' ? 100 : positionSize === 'STANDARD' ? 75 : positionSize === 'REDUCED' ? 50 : positionSize === 'SMALL' ? 25 : 0,
  };
}

module.exports = {
  calcRSI, calcEMA, calcSMA, calcMACD, calcBollingerBands, calcATR,
  calcAllIndicators, calcTimeframeIndicators, calcMultiTimeframe,
  calcVolumeAnalysis, calcConfidenceScore
};
