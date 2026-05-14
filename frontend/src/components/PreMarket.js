import { useState, useEffect, useCallback } from 'react';
import { market } from '../lib/api';

const GAP_STYLES = {
  GAP_UP_LARGE:   { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)',   icon: '▲▲', label: 'Large Gap Up'   },
  GAP_UP:         { color: '#22c55e', bg: 'rgba(34,197,94,0.05)',   border: 'rgba(34,197,94,0.2)',   icon: '▲',  label: 'Gap Up'         },
  NONE:           { color: '#8b8fa8', bg: 'var(--color-background-secondary)', border: 'var(--color-border-tertiary)', icon: '●', label: 'No Gap' },
  GAP_DOWN:       { color: '#ef4444', bg: 'rgba(239,68,68,0.05)',   border: 'rgba(239,68,68,0.2)',   icon: '▼',  label: 'Gap Down'       },
  GAP_DOWN_LARGE: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',   icon: '▼▼', label: 'Large Gap Down' },
};

const MARKET_STATE_LABELS = {
  PRE:     { label: 'Pre-Market',  color: '#f59e0b' },
  REGULAR: { label: 'Market Open', color: '#22c55e' },
  POST:    { label: 'After Hours', color: '#3b82f6' },
  CLOSED:  { label: 'Market Closed', color: '#8b8fa8' },
  UNKNOWN: { label: 'Unknown',     color: '#8b8fa8' },
};

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.6px' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-mono)', color: color || 'var(--color-text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{sub}</div>}
    </div>
  );
}

export default function PreMarket({ signalPreMarket, signalFutures }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await market.premarket();
      setData(res);
      setLastFetch(new Date());
    } catch (err) {
      console.error('Pre-market fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [fetchData]);

  // Prefer signal-embedded data when available
  const pm      = signalPreMarket || data?.preMarket;
  const futures = signalFutures   || data?.futures;

  const gapStyle   = GAP_STYLES[pm?.gapType || 'NONE'];
  const stateStyle = MARKET_STATE_LABELS[pm?.marketState || 'UNKNOWN'];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Pre-Market & Futures</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pm?.marketState && (
            <span style={{ fontSize: 11, fontWeight: 600, color: stateStyle.color, fontFamily: 'var(--font-mono)' }}>
              ● {stateStyle.label}
            </span>
          )}
          {lastFetch && (
            <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={fetchData}>↺</button>
        </div>
      </div>

      {loading && !pm ? (
        <div className="empty">Loading pre-market data...</div>
      ) : (
        <>
          {/* Gap banner */}
          {pm && (
            <div style={{
              background: gapStyle.bg, border: `1px solid ${gapStyle.border}`,
              borderRadius: 'var(--border-radius-md)', padding: '10px 14px', marginBottom: 14,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: gapStyle.color }}>
                  {gapStyle.icon} {gapStyle.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {pm.gapPct !== null
                    ? `${pm.gapPct >= 0 ? '+' : ''}${pm.gapPct}% vs previous close $${pm.previousClose}`
                    : 'Gap data unavailable'}
                </div>
              </div>
              {(pm.gapType === 'GAP_UP_LARGE' || pm.gapType === 'GAP_DOWN_LARGE') && (
                <div style={{ fontSize: 11, color: '#f59e0b', fontStyle: 'italic', maxWidth: 160, textAlign: 'right' }}>
                  ⚠ Large gaps increase opening risk — reduce position size
                </div>
              )}
            </div>
          )}

          {/* SPY price stats */}
          {pm && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
              <StatBox
                label="Pre-Mkt Price"
                value={pm.preMarketPrice ? `$${pm.preMarketPrice}` : '—'}
                color={pm.gapPct > 0 ? '#22c55e' : pm.gapPct < 0 ? '#ef4444' : undefined}
              />
              <StatBox
                label="Prev Close"
                value={pm.previousClose ? `$${pm.previousClose}` : '—'}
              />
              <StatBox
                label="Gap"
                value={pm.gapPct !== null ? `${pm.gapPct >= 0 ? '+' : ''}${pm.gapPct}%` : '—'}
                color={pm.gapPct > 0 ? '#22c55e' : pm.gapPct < 0 ? '#ef4444' : undefined}
                sub={pm.gapDollar !== null ? `${pm.gapDollar >= 0 ? '+' : ''}$${pm.gapDollar}` : null}
              />
            </div>
          )}

          {/* Futures */}
          {futures && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                Futures
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{
                  background: futures.changePct > 0 ? 'rgba(34,197,94,0.06)' : futures.changePct < 0 ? 'rgba(239,68,68,0.06)' : 'var(--color-background-secondary)',
                  border: `0.5px solid ${futures.changePct > 0 ? 'rgba(34,197,94,0.2)' : futures.changePct < 0 ? 'rgba(239,68,68,0.2)' : 'var(--color-border-tertiary)'}`,
                  borderRadius: 'var(--border-radius-md)', padding: '10px 12px'
                }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 3 }}>S&P 500 Futures (ES)</div>
                  <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                    ${futures.price?.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: futures.changePct > 0 ? '#22c55e' : futures.changePct < 0 ? '#ef4444' : '#8b8fa8', marginTop: 2 }}>
                    {futures.changePct !== null ? `${futures.changePct >= 0 ? '+' : ''}${futures.changePct}%` : '—'}
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600 }}>{futures.bias}</span>
                  </div>
                </div>

                {futures.nasdaqFutures && (
                  <div style={{
                    background: futures.nasdaqFutures.changePct > 0 ? 'rgba(34,197,94,0.06)' : futures.nasdaqFutures.changePct < 0 ? 'rgba(239,68,68,0.06)' : 'var(--color-background-secondary)',
                    border: `0.5px solid ${futures.nasdaqFutures.changePct > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    borderRadius: 'var(--border-radius-md)', padding: '10px 12px'
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 3 }}>Nasdaq Futures (NQ)</div>
                    <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                      ${futures.nasdaqFutures.price?.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: futures.nasdaqFutures.changePct > 0 ? '#22c55e' : '#ef4444', marginTop: 2 }}>
                      {futures.nasdaqFutures.changePct !== null ? `${futures.nasdaqFutures.changePct >= 0 ? '+' : ''}${futures.nasdaqFutures.changePct}%` : '—'}
                    </div>
                  </div>
                )}
              </div>

              {/* Futures interpretation */}
              <div style={{
                fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5,
                padding: '8px 10px', background: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-md)'
              }}>
                {futures.bias === 'BULLISH'
                  ? '✓ Futures are bullish — institutional money is positioned for gains. This confirms upside signals.'
                  : futures.bias === 'BEARISH'
                  ? '⚠ Futures are bearish — institutional money is positioned defensively. Be cautious on BUY signals.'
                  : '● Futures are flat — no strong directional conviction from overnight markets.'}
              </div>
            </>
          )}

          {!pm && !futures && (
            <div className="empty">Pre-market data unavailable. Check back during market hours.</div>
          )}
        </>
      )}
    </div>
  );
}
