import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { analytics, personalTrades as ptApi } from '../lib/api';

function KPI({ label, value, sub, color }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: color || 'var(--color-text-primary)', fontSize: 20 }}>{value ?? '—'}</div>
      {sub && <div className="metric-sub neu">{sub}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-title">{title}</div>
      {children}
    </div>
  );
}

export default function Analytics() {
  const [data, setData]             = useState(null);
  const [trades, setTrades]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [exporting, setExporting]   = useState(false);
  const [closing, setClosing]       = useState(null);
  const [exitPrice, setExitPrice]   = useState('');

  async function load() {
    try {
      const [summary, tradeList] = await Promise.all([
        analytics.summary(),
        ptApi.list()
      ]);
      setData(summary);
      setTrades(tradeList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function closeTrade(id) {
    if (!exitPrice) return;
    try {
      await ptApi.close(id, { exit_price: parseFloat(exitPrice) });
      setClosing(null); setExitPrice('');
      load();
    } catch (err) { alert('Failed: ' + err.message); }
  }

  async function exportToExcel() {
    setExporting(true);
    try {
      const exportData = await analytics.export();

      // Build CSV-based Excel-compatible file using data URIs
      // Sheet 1: AI Signal Log
      const sigHeaders = [
        'Date','Signal','Confidence','Entry $','Target $','Stop $',
        'RSI','MACD','VIX','MTF Agreement','Volume','Rotation',
        'Options Flow','Futures','News Impact','Outcome','Outcome P&L%'
      ];
      const sigRows = exportData.signals.map(s => [
        new Date(s.created_at).toLocaleString(),
        s.signal, s.confidence,
        s.entry_price, s.target_price, s.stop_loss,
        s.rsi, s.macd, s.vix,
        s.timeframe_agreement, s.volume_label, s.rotation_signal,
        s.flow_bias, s.futures_bias, s.news_impact,
        s.outcome || 'PENDING',
        s.outcome_pnl_pct || ''
      ]);

      // Sheet 2: Personal Trades
      const tradeHeaders = [
        'Date','Side','Type','Qty','Entry $','Exit $','Target $','Stop $',
        'P&L $','P&L %','Status','AI Signal','AI Confidence',
        'Followed Signal','Emotion (1-5)','Deviation Notes','Notes',
        'RSI at entry','VIX at entry','MTF','Rotation','Flow Bias','News'
      ];
      const tradeRows = exportData.personalTrades.map(t => [
        new Date(t.opened_at).toLocaleString(),
        t.side, t.trade_type, t.quantity,
        t.entry_price, t.exit_price || '',
        t.target_price || '', t.stop_loss || '',
        t.pnl || '', t.pnl_pct || '',
        t.status, t.ai_signal || '', t.ai_confidence || '',
        t.followed_signal ? 'Yes' : 'No',
        t.emotion_rating || '',
        t.deviation_notes || '', t.notes || '',
        t.rsi || '', t.vix || '',
        t.timeframe_agreement || '', t.rotation_signal || '',
        t.flow_bias || '', t.news_impact || ''
      ]);

      // Create workbook HTML (Excel-compatible)
      const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
          <x:ExcelWorksheet><x:Name>AI Signal Log</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
          <x:ExcelWorksheet><x:Name>Personal Trades</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
        </x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        </head><body>
        <table>
          <thead><tr>${sigHeaders.map(h => `<th style="background:#1a1d27;color:#22c55e;font-weight:bold">${h}</th>`).join('')}</tr></thead>
          <tbody>${sigRows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <br><br>
        <table>
          <thead><tr>${tradeHeaders.map(h => `<th style="background:#1a1d27;color:#3b82f6;font-weight:bold">${h}</th>`).join('')}</tr></thead>
          <tbody>${tradeRows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        </body></html>`;

      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `SPY_AI_Trader_${new Date().toISOString().split('T')[0]}.xls`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div className="empty">Loading analytics...</div>;

  const sa = data?.signalAccuracy;
  const tp = data?.tradePerformance;

  // P&L curve from personal trades
  const pnlCurve = trades
    .filter(t => t.status === 'CLOSED' && t.pnl != null)
    .reverse()
    .reduce((acc, t, i) => {
      const prev = acc[i - 1]?.cumPnl || 0;
      acc.push({ i: i + 1, cumPnl: parseFloat((prev + parseFloat(t.pnl)).toFixed(2)), pnl: parseFloat(parseFloat(t.pnl).toFixed(2)) });
      return acc;
    }, []);

  // Signal accuracy by condition
  const conditionData = data?.signalHistory ? (() => {
    const groups = {};
    data.signalHistory.forEach(s => {
      const key = s.timeframe_agreement || 'UNKNOWN';
      if (!groups[key]) groups[key] = { total: 0, hits: 0 };
      groups[key].total++;
      if (s.outcome === 'HIT_TARGET') groups[key].hits++;
    });
    return Object.entries(groups).map(([k, v]) => ({
      name: k.replace('_', ' '),
      winRate: v.total > 0 ? Math.round(v.hits / v.total * 100) : 0,
      count: v.total
    }));
  })() : [];

  return (
    <div>
      {/* Export button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn" onClick={exportToExcel} disabled={exporting}
          style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)', color: '#22c55e' }}>
          {exporting ? 'Exporting...' : '⬇ Export to Excel'}
        </button>
      </div>

      {/* AI Signal accuracy */}
      <Section title="AI Signal Accuracy">
        {sa ? (
          <>
            <div className="metrics" style={{ marginBottom: 14 }}>
              <KPI label="Total Signals"    value={sa.total_signals}  sub="all time" />
              <KPI label="Resolved"         value={sa.resolved_signals} sub="target or stop hit" />
              <KPI label="Signal Win Rate"  value={sa.signal_win_rate != null ? sa.signal_win_rate + '%' : '—'} color={parseFloat(sa.signal_win_rate) >= 50 ? '#22c55e' : '#ef4444'} sub="targets hit" />
              <KPI label="Avg Confidence"   value={sa.avg_confidence != null ? sa.avg_confidence + '%' : '—'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#22c55e', marginBottom: 4 }}>Winners avg confidence</div>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{sa.avg_confidence_winners ?? '—'}</div>
              </div>
              <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 4 }}>Losers avg confidence</div>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{sa.avg_confidence_losers ?? '—'}</div>
              </div>
            </div>
            {conditionData.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Win rate by timeframe agreement</div>
                <div style={{ height: 140 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={conditionData}>
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#555870' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#555870' }} tickFormatter={v => v + '%'} />
                      <Tooltip formatter={v => [v + '%', 'Win Rate']} contentStyle={{ background: '#13151c', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }} />
                      <Bar dataKey="winRate" radius={[3,3,0,0]}>
                        {conditionData.map((e, i) => <Cell key={i} fill={e.winRate >= 60 ? '#22c55e' : e.winRate >= 40 ? '#f59e0b' : '#ef4444'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty">Run AI analyses to see accuracy data build up over time.</div>
        )}
      </Section>

      {/* Personal trade performance */}
      <Section title="Your Trade Performance">
        {tp && parseInt(tp.total_trades) > 0 ? (
          <>
            <div className="metrics" style={{ marginBottom: 14 }}>
              <KPI label="Total Trades"  value={tp.total_trades} />
              <KPI label="Win Rate"      value={tp.win_rate_pct != null ? tp.win_rate_pct + '%' : '—'} color={parseFloat(tp.win_rate_pct) >= 50 ? '#22c55e' : '#ef4444'} />
              <KPI label="Total P&L"     value={tp.total_pnl != null ? (parseFloat(tp.total_pnl) >= 0 ? '+$' : '-$') + Math.abs(parseFloat(tp.total_pnl)).toFixed(2) : '—'} color={parseFloat(tp.total_pnl) >= 0 ? '#22c55e' : '#ef4444'} />
              <KPI label="Avg P&L"       value={tp.avg_pnl != null ? (parseFloat(tp.avg_pnl) >= 0 ? '+$' : '-$') + Math.abs(parseFloat(tp.avg_pnl)).toFixed(2) : '—'} color={parseFloat(tp.avg_pnl) >= 0 ? '#22c55e' : '#ef4444'} />
            </div>
            <div className="metrics" style={{ marginBottom: 14 }}>
              <KPI label="Best Trade"    value={tp.best_trade  != null ? '+$' + parseFloat(tp.best_trade).toFixed(2)  : '—'} color="#22c55e" />
              <KPI label="Worst Trade"   value={tp.worst_trade != null ? '-$' + Math.abs(parseFloat(tp.worst_trade)).toFixed(2) : '—'} color="#ef4444" />
              <KPI label="Followed AI"   value={tp.followed_signal_count} sub="trades" />
              <KPI label="Deviated"      value={tp.deviated_count} sub="from signal" />
            </div>

            {pnlCurve.length > 1 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Cumulative P&L curve</div>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pnlCurve}>
                      <XAxis dataKey="i" tick={{ fontSize: 9, fill: '#555870' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#555870' }} tickLine={false} axisLine={false} tickFormatter={v => '$' + v} />
                      <Tooltip formatter={v => ['$' + v, 'Cum P&L']} contentStyle={{ background: '#13151c', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }} />
                      <Line type="monotone" dataKey="cumPnl" stroke={parseFloat(tp.total_pnl) >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty">Use the "I took this trade" button on the Dashboard to start tracking your personal trades.</div>
        )}
      </Section>

      {/* Personal trade log */}
      <Section title="Personal Trade Log">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button className="btn" onClick={load} style={{ fontSize: 11, padding: '5px 12px' }}>↺ Refresh</button>
        </div>
        {trades.length === 0 ? (
          <div className="empty">No personal trades logged yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th><th>Side</th><th>Type</th><th>Qty</th>
                  <th>Entry</th><th>Exit</th><th>P&L</th><th>Status</th>
                  <th>AI Signal</th><th>Followed</th><th>Emotion</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(t.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td><span className={`badge badge-${t.side.toLowerCase()}`}>{t.side}</span></td>
                    <td style={{ fontSize: 11 }}>{t.trade_type}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.quantity}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>${parseFloat(t.entry_price).toFixed(2)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.exit_price ? '$' + parseFloat(t.exit_price).toFixed(2) : '—'}</td>
                    <td className={t.pnl > 0 ? 'up' : t.pnl < 0 ? 'down' : 'neu'} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>
                      {t.pnl != null ? (parseFloat(t.pnl) >= 0 ? '+$' : '-$') + Math.abs(parseFloat(t.pnl)).toFixed(2) : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${t.status === 'OPEN' ? 'open' : parseFloat(t.pnl) > 0 ? 'win' : 'loss'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td><span className={`badge badge-${(t.ai_signal || '').toLowerCase()}`}>{t.ai_signal || '—'}</span></td>
                    <td style={{ fontSize: 11, color: t.followed_signal ? '#22c55e' : '#f59e0b' }}>
                      {t.followed_signal ? '✓ Yes' : '✗ No'}
                    </td>
                    <td style={{ fontSize: 13 }}>{'⭐'.repeat(t.emotion_rating || 0)}</td>
                    <td>
                      {t.status === 'OPEN' && (
                        closing === t.id ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input type="number" placeholder="Exit $" value={exitPrice} onChange={e => setExitPrice(e.target.value)}
                              style={{ width: 70, padding: '4px 6px', background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: 4, color: 'var(--color-text-primary)', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                            <button className="btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => closeTrade(t.id)}>✓</button>
                            <button className="btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setClosing(null)}>✕</button>
                          </div>
                        ) : (
                          <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setClosing(t.id)}>Close</button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
