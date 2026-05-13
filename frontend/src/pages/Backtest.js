import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { backtest as backtestApi } from '../lib/api';

const STRATEGIES = [
  { value: 'rsi', label: 'RSI Mean Reversion', desc: 'Buy when oversold (<35), sell when overbought (>68)' },
  { value: 'macd', label: 'MACD Crossover', desc: 'Buy on bullish MACD cross, sell on bearish cross' },
  { value: 'ma', label: 'Moving Avg Crossover', desc: 'Buy on golden cross (50>200), sell on death cross' },
  { value: 'combo', label: 'Combined (AI-style)', desc: 'Requires 2+ indicators to agree before signaling' },
];

export default function Backtest() {
  const [strategy, setStrategy] = useState('combo');
  const [days, setDays] = useState(90);
  const [capital, setCapital] = useState(10000);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    backtestApi.history().then(setHistory).catch(() => {});
  }, []);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const data = await backtestApi.run({ strategy, period_days: parseInt(days), starting_capital: parseFloat(capital) });
      setResult(data);
      backtestApi.history().then(setHistory).catch(() => {});
    } catch (err) {
      setError('Backtest failed: ' + err.message);
    } finally {
      setRunning(false);
    }
  }

  const chartData = result?.equityCurve?.map((pt, i) => ({
    day: `D${pt.day}`,
    strategy: pt.value,
    benchmark: result.benchmark ? parseFloat((capital * (1 + (i / (result.equityCurve.length - 1)) * (result.benchmark.totalReturn / 100))).toFixed(2)) : null,
  }));

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-title">Backtest Parameters</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Strategy</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 6, color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)' }}>
              {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              {STRATEGIES.find(s => s.value === strategy)?.desc}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Lookback Period</label>
            <select value={days} onChange={e => setDays(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 6, color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)' }}>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>1 year</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Starting Capital</label>
            <input type="number" value={capital} onChange={e => setCapital(e.target.value)} step={1000}
              style={{ width: '100%', padding: '9px 10px', background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 6, color: 'var(--text)', fontSize: 13, fontFamily: 'var(--mono)' }} />
          </div>
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <button className="btn btn-full btn-green" onClick={run} disabled={running}>
          {running ? 'Running backtest on real SPY data...' : '▶ Run Backtest ↗'}
        </button>
      </div>

      {result && (
        <>
          <div className="metrics" style={{ marginBottom: 12 }}>
            <div className="metric">
              <div className="metric-label">Final Equity</div>
              <div className={`metric-value ${result.finalEquity >= capital ? 'up' : 'down'}`}>${result.finalEquity?.toLocaleString()}</div>
              <div className={`metric-sub ${result.totalReturn >= 0 ? 'up' : 'down'}`}>{result.totalReturn >= 0 ? '+' : ''}{result.totalReturn}%</div>
            </div>
            <div className="metric">
              <div className="metric-label">Win Rate</div>
              <div className={`metric-value ${result.winRate >= 50 ? 'up' : 'down'}`}>{result.winRate}%</div>
              <div className="metric-sub neu">{result.wins}W / {result.losses}L ({result.totalTrades} trades)</div>
            </div>
            <div className="metric">
              <div className="metric-label">Max Drawdown</div>
              <div className="metric-value down">-{result.maxDrawdown}%</div>
              <div className="metric-sub neu">peak to trough</div>
            </div>
            <div className="metric">
              <div className="metric-label">vs Buy & Hold</div>
              <div className={`metric-value ${result.totalReturn >= result.benchmark?.totalReturn ? 'up' : 'down'}`}>
                {result.totalReturn >= (result.benchmark?.totalReturn ?? 0) ? '▲' : '▼'} {Math.abs(result.totalReturn - (result.benchmark?.totalReturn ?? 0)).toFixed(1)}%
              </div>
              <div className="metric-sub neu">B&H: {result.benchmark?.totalReturn >= 0 ? '+' : ''}{result.benchmark?.totalReturn}%</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Equity Curve vs Buy & Hold</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 3, background: result.totalReturn >= 0 ? '#22c55e' : '#ef4444', display: 'inline-block', borderRadius: 2 }}></span> Strategy</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 3, background: '#3b82f6', display: 'inline-block', borderRadius: 2, opacity: .7 }}></span> Buy & Hold</span>
            </div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#555870' }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#555870' }} tickLine={false} axisLine={false} tickFormatter={v => '$' + v.toLocaleString()} />
                  <Tooltip formatter={v => ['$' + v.toLocaleString()]} contentStyle={{ background: '#13151c', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 12 }} />
                  <Line type="monotone" dataKey="strategy" stroke={result.totalReturn >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} dot={false} name="Strategy" />
                  <Line type="monotone" dataKey="benchmark" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Buy & Hold" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {result.trades?.length > 0 && (
            <div className="card">
              <div className="card-title">Trade Breakdown (last {result.trades.length})</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Day</th><th>Entry</th><th>Exit</th><th>Shares</th><th>P&L</th><th>Return</th><th>Reason</th></tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>D{t.day}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>${t.entry?.toFixed(2)}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>${t.exit?.toFixed(2)}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{t.shares}</td>
                        <td className={t.pnl >= 0 ? 'up' : 'down'} style={{ fontFamily: 'var(--mono)' }}>
                          {t.pnl >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                        </td>
                        <td className={t.pnlPct >= 0 ? 'up' : 'down'} style={{ fontFamily: 'var(--mono)' }}>
                          {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct?.toFixed(2)}%
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{t.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {history.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">Backtest History (stored in database)</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr><th>Date</th><th>Strategy</th><th>Period</th><th>Capital</th><th>Return</th><th>Win Rate</th><th>Trades</th><th>Max DD</th></tr>
              </thead>
              <tbody>
                {history.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{new Date(b.run_at).toLocaleDateString()}</td>
                    <td>{b.strategy}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{b.period_days}d</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>${parseFloat(b.starting_capital).toLocaleString()}</td>
                    <td className={b.total_return_pct >= 0 ? 'up' : 'down'} style={{ fontFamily: 'var(--mono)' }}>
                      {b.total_return_pct >= 0 ? '+' : ''}{b.total_return_pct}%
                    </td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{b.win_rate_pct}%</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{b.total_trades}</td>
                    <td className="down" style={{ fontFamily: 'var(--mono)' }}>-{b.max_drawdown_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
