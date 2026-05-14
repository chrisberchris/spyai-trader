const axios = require('axios');

const POLYGON_KEY = process.env.POLYGON_API_KEY;
const BASE = 'https://api.polygon.io';

async function getSpyQuote() {
  try {
    // Primary: Polygon.io real-time quote
    const res = await axios.get(`${BASE}/v2/last/trade/SPY`, {
      params: { apiKey: POLYGON_KEY },
      timeout: 5000
    });
    const t = res.data.results;
    return {
      symbol: 'SPY',
      price: t.p,
      size: t.s,
      timestamp: new Date(t.t).toISOString(),
      source: 'polygon'
    };
  } catch (err) {
    // Fallback: yFinance via unofficial endpoint (no key needed)
    try {
      const res = await axios.get(
        'https://query1.finance.yahoo.com/v8/finance/chart/SPY',
        { params: { interval: '1m', range: '1d' }, timeout: 5000 }
      );
      const meta = res.data.chart.result[0].meta;
      return {
        symbol: 'SPY',
        price: meta.regularMarketPrice,
        open: meta.regularMarketOpen,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        volume: meta.regularMarketVolume,
        previousClose: meta.previousClose,
        timestamp: new Date().toISOString(),
        source: 'yahoo'
      };
    } catch (err2) {
      console.error('Both market data sources failed:', err2.message);
      return null;
    }
  }
}

async function getSpySnapshot() {
  try {
    const res = await axios.get(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/SPY`, {
      params: { apiKey: POLYGON_KEY },
      timeout: 5000
    });
    const snap = res.data.ticker;
    return {
      symbol: 'SPY',
      price: snap.lastTrade.p,
      open: snap.day.o,
      high: snap.day.h,
      low: snap.day.l,
      volume: snap.day.v,
      change: snap.todaysChange,
      changePct: snap.todaysChangePerc,
      prevClose: snap.prevDay.c,
      source: 'polygon'
    };
  } catch {
    return await getSpyQuote();
  }
}

async function getVix() {
  try {
    const res = await axios.get(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX',
      { params: { interval: '1m', range: '1d' }, timeout: 5000 }
    );
    const meta = res.data.chart.result[0].meta;
    return parseFloat(meta.regularMarketPrice.toFixed(2));
  } catch {
    return null;
  }
}

async function getHistoricalBars(symbol = 'SPY', days = 90) {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  try {
    const res = await axios.get(`${BASE}/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}`, {
      params: { adjusted: true, sort: 'asc', limit: 365, apiKey: POLYGON_KEY },
      timeout: 8000
    });
    return res.data.results || [];
  } catch {
    // Yahoo fallback
    try {
      const res = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
        { params: { interval: '1d', range: days <= 30 ? '1mo' : days <= 90 ? '3mo' : days <= 180 ? '6mo' : '1y' }, timeout: 8000 }
      );
      const r = res.data.chart.result[0];
      const timestamps = r.timestamp;
      const quotes = r.indicators.quote[0];
      return timestamps.map((t, i) => ({
        t: t * 1000,
        o: quotes.open[i],
        h: quotes.high[i],
        l: quotes.low[i],
        c: quotes.close[i],
        v: quotes.volume[i]
      })).filter(b => b.c !== null);
    } catch {
      return [];
    }
  }
}

// Fetch intraday bars — hourly or 15-minute
async function getIntradayBars(symbol = 'SPY', multiplier = 1, timespan = 'hour', days = 5) {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  try {
    const res = await axios.get(
      `${BASE}/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}`,
      { params: { adjusted: true, sort: 'asc', limit: 500, apiKey: POLYGON_KEY }, timeout: 8000 }
    );
    return res.data.results || [];
  } catch {
    // Yahoo fallback — 1h or 15m
    try {
      const interval = timespan === 'hour' ? '1h' : '15m';
      const range = days <= 5 ? '5d' : '1mo';
      const res = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
        { params: { interval, range }, timeout: 8000 }
      );
      const r = res.data.chart.result[0];
      const timestamps = r.timestamp || [];
      const quotes = r.indicators.quote[0];
      return timestamps.map((t, i) => ({
        t: t * 1000,
        o: quotes.open[i],
        h: quotes.high[i],
        l: quotes.low[i],
        c: quotes.close[i],
        v: quotes.volume[i]
      })).filter(b => b.c !== null);
    } catch {
      return [];
    }
  }
}

module.exports = { getSpyQuote, getSpySnapshot, getVix, getHistoricalBars, getIntradayBars };
