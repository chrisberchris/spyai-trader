import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { supabase } from '../lib/supabase';

const BASE = process.env.REACT_APP_API_URL || '';

async function authGet(path) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  const res = await axios.get(`${BASE}${path}`, { headers });
  return res.data;
}

async function authPost(path, body = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  const res = await axios.post(`${BASE}${path}`, body, { headers });
  return res.data;
}

const STATUS_COLORS = {
  EXECUTED:      { color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
  GATES_FAILED:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'},
  MARKET_CLOSED: { color: '#8b8fa8', bg: 'var(--color-background-secondary)' },
  ERROR:         { color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  ACCOUNT_BLOCKED: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  NO_DATA:       { color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  ZERO_SHARES:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'},
};

function KPI({ label, value, sub, color }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ fontSize: 18, color: color || 'var(--color-text-primary)' }}>{value ?? '—'}</div>
      {sub && <div className="metric-sub neu">{sub}</div>}
    </div>
  );
}

export default function AutoTrader() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [running, setRunning]   = useState(false);
  const [error, setError]       = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  async function load() {
    try {
      const res = await authGet('/api/autotrader/status');
      setData(res);
      setError('');
    } catch (err) {
      if (err.response?.status === 500 && err.response?.data?.error?.includes('ALPACA')) {
        setError('Alpaca API keys not configured. Add ALPACA_API_KEY and ALPACA_SECRET_KEY to your Render environment variables.');
      } else {
        setError(err.response?.data?.error || err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);

  async function runNow() {
    setRunning(true);
    try {
      await authPost('/api/autotrader/run-now');
      setTimeout(load, 5000); // reload after 5s to see result
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <div className="empty">Connecting to Alpaca paper trading account...</div>;

  if (error) return (
    <div className="card">
      <div className="card-title">Auto-Trader Setup Required</div>
      <div style={{ fontSize: 13, color: '#ef4444', padding: '10px 0', marginBottom: 16 }}>{error}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>Setup steps:</strong><br />
        1. Go to <a href="https://alpaca.markets" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>alpaca.markets</a> and create a free account<br />
        2. Switch to <strong>Paper Trading</strong> mode<br />
        3. Go to API Keys and generate a new key pair<br />
        4. Add to Render environment variables:<br />
        <code style={{ background: 'var(--color-background-secondary)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>ALPACA_API_KEY</code> and <code style={{ background: 'var(--color-background-secondary)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>ALPACA_SECRET_KEY</code><br />
        5. Redeploy Render and come back here
      </div>
    </div>
  );

  const { account, clock, positions, orders, recentTrades, recentScans, performance } = data || {};

  // P&L curve
  const pnlCurve = (recentTrades || [])
    .filter(t => t.status === 'CLOSED' && t.pnl != null)
    .reverse()
    .reduce((acc, t, i) => {
      const prev = acc[i - 1]?.cumPnl || 0;
      acc.push({ i: i + 1, cumPnl: parseFloat((prev + parseFloat(t.pnl)).toFixed(2)) });
      return acc;
    }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>Auto-Trader</div>
          <div style={{ fontSize: 12, color: clock?.isOpen ? '#22c55e' : '#8b8fa8', marginTop: 2 }}>
            {clock?.isOpen ? '● Market Open — scanning every 15 minutes' : '● Market Closed — auto-trader paused'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 11, padding: '6px 12px' }}>↺ Refresh</button>
          <button className="btn" onClick={runNow} disabled={running}
            style={{ fontSize: 11, padding: '6px 14px', background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)', color: '#22c55e', fontWeight: 600 }}>
            {running ? 'Running...' : '▶ Run Now'}
          </button>
        </div>
      </div>

      {/* Account KPIs */}
      {account && (
        <div className="metrics" style={{ marginBottom: 12 }}>
          <KPI label="Portfolio Value" value={`$${account.portfolioValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          <KPI label="Cash" value={`$${account.cash?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          <KPI label="Day P&L" value={`${account.dayPL >= 0 ? '+' : ''}$${account.dayPL?.toFixed(2)}`} color={account.dayPL >= 0 ? '#22c55e' : '#ef4444'} />
          <KPI label="Buying Power" value={`$${account.buyingPower?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '0.5px solid var(--color-border-tertiary)', paddingBottom: 0 }}>
        {['overview', 'trades', 'scan log'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t ? 'var(--color-text-primary)' : 'transparent'}`, color: activeTab === t ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', cursor: 'pointer', textTransform: 'capitalize', marginBottom: '-0.5px' }}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Performance */}
          {performance && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-title">Auto-Trade Performance</div>
              <div className="metrics" style={{ marginBottom: performance.closed_trades > 1 ? 14 : 0 }}>
                <KPI label="Total Trades"  value={performance.total_trades} />
                <KPI label="Win Rate"      value={performance.win_rate_pct != null ? performance.win_rate_pct + '%' : '—'} color={parseFloat(performance.win_rate_pct) >= 50 ? '#22c55e' : '#ef4444'} />
                <KPI label="Total P&L"     value={performance.total_pnl != null ? (parseFloat(performance.total_pnl) >= 0 ? '+$' : '-$') + Math.abs(parseFloat(performance.total_pnl)).toFixed(2) : '—'} color={parseFloat(performance.total_pnl) >= 0 ? '#22c55e' : '#ef4444'} />
                <KPI label="Avg P&L/Trade" value={performance.avg_pnl != null ? (parseFloat(performance.avg_pnl) >= 0 ? '+$' : '-$') + Math.abs(parseFloat(performance.avg_pnl)).toFixed(2) : '—'} color={parseFloat(performance.avg_pnl) >= 0 ? '#22c55e' : '#ef4444'} />
              </div>
              {pnlCurve.length > 1 && (
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pnlCurve}>
                      <XAxis dataKey="i" tick={{ fontSize: 9, fill: '#555870' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#555870' }} tickLine={false} axisLine={false} tickFormatter={v => '$' + v} />
                      <Tooltip formatter={v => ['$' + v, 'Cum P&L']} contentStyle={{ background: '#13151c', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }} />
                      <Line type="monotone" dataKey="cumPnl" stroke={parseFloat(performance.total_pnl) >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Open Positions */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Open Positions</div>
            {positions?.length === 0 ? (
              <div className="empty">No open positions — auto-trader is watching for signals</div>
            ) : (
              positions?.map(p => (
                <div key={p.symbol} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 1fr', gap: 10, padding: '10px 0', borderBottom: '0.5px solid var(--color-border-tertiary)', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{p.symbol}</div>
                  <div style={{ fontSize: 12 }}><span style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>Qty</span><br />{p.qty}</div>
                  <div style={{ fontSize: 12 }}><span style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>Entry</span><br />${p.avgEntryPrice?.toFixed(2)}</div>
                  <div style={{ fontSize: 12 }}><span style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>Current</span><br />${p.currentPrice?.toFixed(2)}</div>
                  <div style={{ fontSize: 12 }}><span style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>P&L</span><br /><span className={p.unrealizedPL >= 0 ? 'up' : 'down'}>{p.unrealizedPL >= 0 ? '+' : ''}${p.unrealizedPL?.toFixed(2)} ({p.unrealizedPLPct?.toFixed(2)}%)</span></div>
                </div>
              ))
            )}
          </div>

          {/* Gates explanation */}
          <div className="card">
            <div className="card-title">Trading Gates — All Must Pass</div>
            {[
              ['Confidence ≥ 75',        '✓ Only trades high-conviction signals'],
              ['Volume normal or higher', '✓ Low-volume moves are unreliable'],
              ['Timeframes not mixed',    '✓ Daily, hourly, 15-min must agree'],
              ['VIX below 28',           '✓ Avoids extreme fear environments'],
              ['No calendar event <24h', '✓ Sits out before Fed/CPI/jobs reports'],
              ['No existing position',   '✓ One SPY trade at a time'],
              ['Signal is BUY or SELL',  '✓ HOLD signals are not executed'],
            ].map(([gate, desc]) => (
              <div key={gate} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{gate}</span>
                <span style={{ color: '#22c55e' }}>{desc}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'trades' && (
        <div className="card">
          <div className="card-title">Auto-Trade History</div>
          {!recentTrades?.length ? (
            <div className="empty">No auto-trades executed yet. The system will trade automatically when all gates pass during market hours.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr><th>Date</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th>Target</th><th>Stop</th><th>P&L</th><th>Conf</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {recentTrades.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td><span className={`badge badge-${t.side.toLowerCase()}`}>{t.side}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.qty}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.entry_price ? '$' + parseFloat(t.entry_price).toFixed(2) : '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.exit_price ? '$' + parseFloat(t.exit_price).toFixed(2) : '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#22c55e' }}>{t.target_price ? '$' + parseFloat(t.target_price).toFixed(2) : '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ef4444' }}>{t.stop_loss ? '$' + parseFloat(t.stop_loss).toFixed(2) : '—'}</td>
                      <td className={t.pnl > 0 ? 'up' : t.pnl < 0 ? 'down' : 'neu'} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>
                        {t.pnl != null ? (parseFloat(t.pnl) >= 0 ? '+$' : '-$') + Math.abs(parseFloat(t.pnl)).toFixed(2) : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.confidence}%</td>
                      <td><span className={`badge ${t.outcome === 'WIN' ? 'badge-win' : t.outcome === 'LOSS' ? 'badge-loss' : 'badge-open'}`}>{t.outcome || t.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'scan log' && (
        <div className="card">
          <div className="card-title">Scan Log — Every Decision Recorded</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            Every 15-minute scan is logged here — including why trades were skipped. This is your audit trail.
          </div>
          {!recentScans?.length ? (
            <div className="empty">No scans yet — the auto-trader runs every 15 minutes during market hours (9:30 AM – 4:00 PM ET).</div>
          ) : (
            recentScans.map(scan => {
              const sc = STATUS_COLORS[scan.status] || { color: '#8b8fa8', bg: 'var(--color-background-secondary)' };
              return (
                <div key={scan.id} style={{ padding: '10px 12px', marginBottom: 6, background: sc.bg, borderRadius: 'var(--border-radius-md)', borderLeft: `3px solid ${sc.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: sc.color }}>{scan.status.replace('_', ' ')}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(scan.scanned_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  {scan.signal && (
                    <span className={`badge badge-${scan.signal.toLowerCase()}`} style={{ marginRight: 8 }}>{scan.signal}</span>
                  )}
                  {scan.confidence && (
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginRight: 8 }}>{scan.confidence}% confidence</span>
                  )}
                  {scan.reason && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{scan.reason}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
