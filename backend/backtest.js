const { calcRSI, calcEMA, calcSMA, calcMACD } = require('./indicators');

function runBacktest({ bars, strategy, startingCapital }) {
  const closes = bars.map(b => b.c);
  let cash = startingCapital;
  let shares = 0;
  const equityCurve = [{ day: 0, value: startingCapital, price: closes[0] }];
  const trades = [];
  let openTrade = null;
  let peak = startingCapital;
  let maxDrawdown = 0;
  let wins = 0, losses = 0;

  for (let i = 30; i < bars.length; i++) {
    const slice = closes.slice(0, i + 1);
    const price = closes[i];
    const equity = cash + shares * price;

    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;

    let signal = 'HOLD';
    let reason = '';

    if (strategy === 'rsi') {
      const rsi = calcRSI(slice);
      if (rsi !== null) {
        if (rsi < 35 && shares === 0) { signal = 'BUY'; reason = `RSI ${rsi.toFixed(1)} — oversold`; }
        else if (rsi > 68 && shares > 0) { signal = 'SELL'; reason = `RSI ${rsi.toFixed(1)} — overbought`; }
      }
    } else if (strategy === 'macd') {
      const ema12 = calcEMA(slice, 12);
      const ema26 = calcEMA(slice, 26);
      if (ema12 && ema26) {
        const macd = ema12 - ema26;
        const prevSlice = closes.slice(0, i);
        const prevEma12 = calcEMA(prevSlice, 12);
        const prevEma26 = calcEMA(prevSlice, 26);
        if (prevEma12 && prevEma26) {
          const prevMacd = prevEma12 - prevEma26;
          if (macd > 0 && prevMacd <= 0 && shares === 0) { signal = 'BUY'; reason = `MACD bullish cross (${macd.toFixed(3)})`; }
          else if (macd < 0 && prevMacd >= 0 && shares > 0) { signal = 'SELL'; reason = `MACD bearish cross (${macd.toFixed(3)})`; }
        }
      }
    } else if (strategy === 'ma') {
      const sma50 = calcSMA(slice, 50);
      const sma200 = calcSMA(slice, Math.min(200, slice.length));
      if (sma50 && sma200) {
        if (sma50 > sma200 && shares === 0 && i > 0) { signal = 'BUY'; reason = `Golden cross — 50MA above 200MA`; }
        else if (sma50 < sma200 && shares > 0) { signal = 'SELL'; reason = `Death cross — 50MA below 200MA`; }
      }
    } else if (strategy === 'combo') {
      const rsi = calcRSI(slice);
      const ema12 = calcEMA(slice, 12);
      const ema26 = calcEMA(slice, 26);
      const sma50 = calcSMA(slice, 50);
      if (rsi && ema12 && ema26 && sma50) {
        const macd = ema12 - ema26;
        const bullCount = [rsi < 45, macd > 0, price > sma50].filter(Boolean).length;
        const bearCount = [rsi > 60, macd < 0, price < sma50].filter(Boolean).length;
        if (bullCount >= 2 && shares === 0) { signal = 'BUY'; reason = `Combined: RSI ${rsi.toFixed(0)}, MACD ${macd.toFixed(2)}, price vs 50MA`; }
        else if (bearCount >= 2 && shares > 0) { signal = 'SELL'; reason = `Combined: bearish confluence detected`; }
      }
    }

    if (signal === 'BUY' && cash >= price) {
      shares = Math.floor(cash / price);
      const cost = shares * price;
      cash -= cost;
      openTrade = { day: i, entry: price, reason };
    } else if (signal === 'SELL' && shares > 0 && openTrade) {
      const proceeds = shares * price;
      const pnl = proceeds - openTrade.entry * shares;
      const pnlPct = (price - openTrade.entry) / openTrade.entry * 100;
      if (pnl > 0) wins++; else losses++;
      trades.push({
        day: i,
        signal: 'BUY→SELL',
        entry: parseFloat(openTrade.entry.toFixed(2)),
        exit: parseFloat(price.toFixed(2)),
        shares,
        pnl: parseFloat(pnl.toFixed(2)),
        pnlPct: parseFloat(pnlPct.toFixed(2)),
        reason
      });
      cash += proceeds;
      shares = 0;
      openTrade = null;
    }

    if (i % 5 === 0 || i === bars.length - 1) {
      equityCurve.push({ day: i, value: parseFloat((cash + shares * price).toFixed(2)), price: parseFloat(price.toFixed(2)) });
    }
  }

  const finalPrice = closes[closes.length - 1];
  const finalEquity = parseFloat((cash + shares * finalPrice).toFixed(2));
  const totalReturn = parseFloat(((finalEquity - startingCapital) / startingCapital * 100).toFixed(2));
  const winRate = trades.length > 0 ? parseFloat((wins / trades.length * 100).toFixed(1)) : 0;

  // Benchmark: buy and hold
  const bhShares = Math.floor(startingCapital / closes[30]);
  const bhCash = startingCapital - bhShares * closes[30];
  const bhFinal = bhCash + bhShares * finalPrice;
  const bhReturn = parseFloat(((bhFinal - startingCapital) / startingCapital * 100).toFixed(2));

  return {
    startingCapital,
    finalEquity,
    totalReturn,
    winRate,
    totalTrades: trades.length,
    wins,
    losses,
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    equityCurve,
    trades: trades.slice(-50),
    benchmark: { finalEquity: parseFloat(bhFinal.toFixed(2)), totalReturn: bhReturn }
  };
}

module.exports = { runBacktest };
