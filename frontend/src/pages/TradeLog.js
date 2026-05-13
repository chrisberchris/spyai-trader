import { useState, useEffect } from 'react';
import { trades as tradesApi } from '../lib/api';

export default function TradeLog() {
  const [tradeList, setTradeList] = useState([]);
  const [perf, setPerf] = useState(null);
  const [closing, setClosing] = useState(null);
  const [exitPrice, setExitPrice] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [t, p] = await Promise.all([tradesApi.list(), tradesApi.performance()]);
      setTradeList(t);
      setPerf(p);
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
      await tradesApi.close(id, { exit_price: parseFloat(exitPrice) });
      setClosing(null);
      setExitPrice('');
      load();
    } catch (err) {
      alert('Failed to close trade: ' + err.message);
    }
  }

  const totalPnl = parseFloat(perf?.total_pnl ?? 0);

  return (
    <div>
      {perf && (
        <div className="metrics" style={{ marginBottom: 14 }}>
          <div className="metric">
            <div className="metric-label">Total Trades</div>
            <div className="metric-value">{perf.total_trades ?? 0}</div>
            <div className="metric-sub neu">{perf.closed_trades ?? 0} closed</div>
          </div>
          <div className="metric">
            <div className="metric-label">Win Rate</div>
            <div className={`metric-value ${parseFloat(perf.win_rate_pct) >= 50 ? 'up' : 'down'}`}>
              {perf.win_rate_pct ?? '—'}%
            </div>
            <div className="metric-sub neu">{perf.winning_trades ?? 0}W / {(perf.closed_trades - perf.winning_trades) || 0}L</div>
          </div>
          <div className="metric">
            <div className="metric-label">Total P&L</div>
            <div className={`metric-value ${totalPnl >= 0 ? 'up' : 'down'}`}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </div>
            <div className="metric-sub neu">realized</div>
          </div>
          <div className="metric">
            <div className="metric-label">Avg P&L / Trade</div>
            <div className={`metric-value ${parseFloat(perf.avg_pnl) >= 0 ? 'up' : 'down'}`}>
              {parseFloat(perf.avg_pnl) >= 0 ? '+' : ''}${parseFloat(perf.avg_pnl ?? 0).toFixed(2)}
            </div>
            <div className="metric-sub neu">per closed trade</div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Trade History</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Trades are logged automatically when AI generates a signal</div>
        </div>

        {loading ? (
          <div className="empty">Loading trades...</div>
        ) : tradeList.length === 0 ? (
          <div className="empty">No trades yet. Run an AI analysis from the Dashboard to generate your first signal and trade.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Date</th>
                  <th style={{ width: 70 }}>Side</th>
                  <th style={{ width: 50 }}>Qty</th>
                  <th style={{ width: 80 }}>Entry</th>
                  <th style={{ width: 80 }}>Exit</th>
                  <th style={{ width: 80 }}>P&L</th>
                  <th style={{ width: 70 }}>Status</th>
                  <th style={{ width: 100 }}>Action</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {tradeList.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text2)', fontSize: 12 }}>
                      {new Date(t.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td><span className={`badge badge-${t.side.toLowerCase()}`}>{t.side}</span></td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{t.quantity}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>${parseFloat(t.entry_price).toFixed(2)}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{t.exit_price ? '$' + parseFloat(t.exit_price).toFixed(2) : '—'}</td>
                    <td className={t.pnl > 0 ? 'up' : t.pnl < 0 ? 'down' : 'neu'} style={{ fontFamily: 'var(--mono)' }}>
                      {t.pnl != null ? `${t.pnl > 0 ? '+' : ''}$${parseFloat(t.pnl).toFixed(2)}` : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${t.status === 'OPEN' ? 'open' : t.pnl > 0 ? 'win' : 'loss'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>
                      {t.status === 'OPEN' && (
                        closing === t.id ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input
                              type="number"
                              placeholder="Exit $"
                              value={exitPrice}
                              onChange={e => setExitPrice(e.target.value)}
                              style={{ width: 72, padding: '4px 6px', background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 4, color: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)' }}
                            />
                            <button className="btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => closeTrade(t.id)}>✓</button>
                            <button className="btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setClosing(null)}>✕</button>
                          </div>
                        ) : (
                          <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setClosing(t.id)}>
                            Close
                          </button>
                        )
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{t.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
