const axios = require('axios');

// All 11 S&P 500 sector ETFs with descriptions
const SECTORS = [
  { symbol: 'XLK',  name: 'Technology',        type: 'offensive', icon: '💻' },
  { symbol: 'XLY',  name: 'Consumer Disc.',     type: 'offensive', icon: '🛍️' },
  { symbol: 'XLC',  name: 'Communication',      type: 'offensive', icon: '📡' },
  { symbol: 'XLI',  name: 'Industrials',        type: 'offensive', icon: '🏭' },
  { symbol: 'XLB',  name: 'Materials',          type: 'offensive', icon: '⛏️' },
  { symbol: 'XLE',  name: 'Energy',             type: 'mixed',     icon: '⚡' },
  { symbol: 'XLF',  name: 'Financials',         type: 'mixed',     icon: '🏦' },
  { symbol: 'XLRE', name: 'Real Estate',        type: 'defensive', icon: '🏠' },
  { symbol: 'XLP',  name: 'Consumer Staples',   type: 'defensive', icon: '🛒' },
  { symbol: 'XLU',  name: 'Utilities',          type: 'defensive', icon: '🔌' },
  { symbol: 'XLV',  name: 'Health Care',        type: 'defensive', icon: '🏥' },
];

async function getSectorData() {
  // Fetch all sectors in parallel from Yahoo Finance (no API key needed)
  const results = await Promise.allSettled(
    SECTORS.map(async (sector) => {
      try {
        const res = await axios.get(
          `https://query1.finance.yahoo.com/v8/finance/chart/${sector.symbol}`,
          { params: { interval: '1d', range: '5d' }, timeout: 6000 }
        );
        const meta   = res.data.chart.result[0].meta;
        const quotes = res.data.chart.result[0].indicators.quote[0];
        const closes = (quotes.close || []).filter(c => c !== null);

        const price      = meta.regularMarketPrice;
        const prevClose  = meta.previousClose || meta.chartPreviousClose;
        const change     = prevClose ? parseFloat((price - prevClose).toFixed(2))           : null;
        const changePct  = prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : null;

        // 5-day return
        const fiveDayReturn = closes.length >= 2
          ? parseFloat(((closes[closes.length - 1] - closes[0]) / closes[0] * 100).toFixed(2))
          : null;

        return {
          ...sector,
          price,
          prevClose,
          change,
          changePct,
          fiveDayReturn,
          volume: meta.regularMarketVolume,
          dayHigh: meta.regularMarketDayHigh,
          dayLow:  meta.regularMarketDayLow,
        };
      } catch {
        return { ...sector, price: null, changePct: null, error: true };
      }
    })
  );

  const sectors = results.map(r => r.status === 'fulfilled' ? r.value : { ...r.reason, error: true });

  // Calculate rotation analysis
  const valid = sectors.filter(s => s.changePct !== null);
  const offensive = valid.filter(s => s.type === 'offensive');
  const defensive = valid.filter(s => s.type === 'defensive');

  const avgOffensive = offensive.length
    ? parseFloat((offensive.reduce((a, s) => a + s.changePct, 0) / offensive.length).toFixed(2))
    : null;
  const avgDefensive = defensive.length
    ? parseFloat((defensive.reduce((a, s) => a + s.changePct, 0) / defensive.length).toFixed(2))
    : null;

  // Rotation signal
  let rotationSignal = 'NEUTRAL';
  let rotationStrength = 0;
  if (avgOffensive !== null && avgDefensive !== null) {
    const diff = avgOffensive - avgDefensive;
    rotationStrength = parseFloat(diff.toFixed(2));
    if      (diff >  0.5) rotationSignal = 'RISK_ON';      // money moving into offensive = bullish
    else if (diff >  0.2) rotationSignal = 'MILD_RISK_ON';
    else if (diff < -0.5) rotationSignal = 'RISK_OFF';     // money moving into defensive = bearish
    else if (diff < -0.2) rotationSignal = 'MILD_RISK_OFF';
  }

  // Top movers
  const sorted    = [...valid].sort((a, b) => b.changePct - a.changePct);
  const leaders   = sorted.slice(0, 3);
  const laggards  = sorted.slice(-3).reverse();

  // Breadth: how many sectors are positive
  const positive  = valid.filter(s => s.changePct > 0).length;
  const breadthPct = valid.length ? Math.round(positive / valid.length * 100) : null;

  // Confidence modifier for AI
  let confidenceModifier = 0;
  if      (rotationSignal === 'RISK_ON')       confidenceModifier =  10;
  else if (rotationSignal === 'MILD_RISK_ON')  confidenceModifier =   5;
  else if (rotationSignal === 'RISK_OFF')      confidenceModifier = -10;
  else if (rotationSignal === 'MILD_RISK_OFF') confidenceModifier =  -5;

  return {
    sectors,
    rotation: {
      signal: rotationSignal,
      strength: rotationStrength,
      avgOffensive,
      avgDefensive,
      confidenceModifier,
      breadthPct,
      positiveCount: positive,
      totalCount: valid.length,
    },
    leaders,
    laggards,
    fetchedAt: new Date().toISOString()
  };
}

// Build sector context string for AI prompt
function buildSectorContext(sectorData) {
  if (!sectorData) return 'Sector data unavailable.';
  const { rotation, leaders, laggards } = sectorData;

  const lines = [
    `Rotation signal: ${rotation.signal.replace('_', ' ')} (offensive avg: ${rotation.avgOffensive}%, defensive avg: ${rotation.avgDefensive}%)`,
    `Market breadth: ${rotation.positiveCount}/${rotation.totalCount} sectors positive (${rotation.breadthPct}%)`,
    `Leading sectors: ${leaders.map(s => `${s.name} (${s.changePct >= 0 ? '+' : ''}${s.changePct}%)`).join(', ')}`,
    `Lagging sectors: ${laggards.map(s => `${s.name} (${s.changePct >= 0 ? '+' : ''}${s.changePct}%)`).join(', ')}`,
    `Confidence modifier from rotation: ${rotation.confidenceModifier > 0 ? '+' : ''}${rotation.confidenceModifier} points`,
  ];

  return lines.join('\n');
}

module.exports = { getSectorData, buildSectorContext, SECTORS };
