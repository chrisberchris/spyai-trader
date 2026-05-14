import { useState, useEffect, useCallback } from 'react';
import { market } from '../lib/api';

const FLOW_STYLES = {
  BULLISH:       { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)',   icon: '▲▲', label: 'Bullish Flow'       },
  MILD_BULLISH:  { color: '#22c55e', bg: 'rgba(34,197,94,0.05)',   border: 'rgba(34,197,94,0.2)',   icon: '▲',  label: 'Mild Bullish Flow'  },
  NEUTRAL:       { color: '#8b8fa8', bg: 'var(--color-background-secondary)', border: 'var(--color-border-tertiary)', icon: '●', label: 'Neutral Flow' },
  MILD_BEARISH:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.25)', icon: '▼',  label: 'Mild Bearish Flow'  },
  BEARISH:       { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',   icon: '▼▼', label: 'Bearish Flow'       },
};

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(0) + 'K';
  return n.toString();
}

function ContractRow({ contract, type }) {
  const color = type === 'CALL' ? '#22c55e' : '#ef4444';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60px 55px 55px 55px 1fr', gap: 6, padding: '6px 0', borderBottom: '0.5px solid var(--color-border-tertiary)', alignItems: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color }}>
        ${contract.strike}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
        {contract.expiryDate || contract.expiry}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-primary)' }}>
        {fmt(contract.volume)}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: contract.volToOI >= 3 ? color : 'var(--color-text-secondary)', fontWeight: contract.unusual ? 600 : 400 }}>
        {contract.volToOI}x
      </div>
      <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
        {contract.impliedVol ? `IV: ${contract.impliedVol}%` : ''} {contract.inTheMoney ? '• ITM' : ''}
        {contract.unusual && <span style={{ marginLeft: 4, color, fontWeight: 600 }}>★ unusual</span>}
      </div>
    </div>
  );
}

export default function OptionsFlow({ signalOptionsFlow }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async () => {
    try {
      const res = await market.optionsFlow();
      setData(res);
      setLastFetch(new Date());
    } catch (err) {
      console.error('Options flow fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10 * 60 * 1000); // refresh every 10 min
    return () => clearInterval(interval);
  }, [fetchData]);

  const display = signalOptionsFlow || data;
  const fs = FLOW_STYLES[display?.flowBias || 'NEUTRAL'];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Options Flow</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['overview', 'calls', 'puts'].map(t => (
            <button key={t} className="btn" onClick={() => setActiveTab(t)}
              style={{ padding: '4px 10px', fontSize: 11, background: activeTab === t ? 'var(--color-background-secondary)' : 'transparent', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
          <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={fetchData}>↺</button>
        </div>
      </div>

      {loading && !display ? (
        <div className="empty">Loading options flow data...</div>
      ) : !display ? (
        <div className="empty">Options flow unavailable. Markets may be closed.</div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <>
              {/* Flow bias banner */}
              <div style={{
                background: fs.bg, border: `1px solid ${fs.border}`,
                borderRadius: 'var(--border-radius-md)', padding: '10px 14px', marginBottom: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: fs.color }}>{fs.icon} {fs.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {display.unusualSummary}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: display.putCallRatio > 1.2 ? '#ef4444' : display.putCallRatio < 0.8 ? '#22c55e' : '#8b8fa8' }}>
                      {display.putCallRatio ?? '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>P/C ratio</div>
                  </div>
                </div>
              </div>

              {/* Volume stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
                {[
                  ['Call Vol',  fmt(display.totalCallVol), '#22c55e'],
                  ['Put Vol',   fmt(display.totalPutVol),  '#ef4444'],
                  ['Call OI',   fmt(display.totalCallOI),  '#22c55e'],
                  ['Put OI',    fmt(display.totalPutOI),   '#ef4444'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* P/C ratio bar */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 3 }}>
                  <span style={{ color: '#22c55e' }}>Calls</span>
                  <span style={{ color: '#8b8fa8' }}>Neutral (1.0)</span>
                  <span style={{ color: '#ef4444' }}>Puts</span>
                </div>
                <div style={{ height: 8, background: 'var(--color-background-secondary)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  {display.totalCallVol > 0 && (
                    <div style={{ flex: display.totalCallVol, background: '#22c55e', opacity: 0.7, transition: 'flex .5s' }} />
                  )}
                  {display.totalPutVol > 0 && (
                    <div style={{ flex: display.totalPutVol, background: '#ef4444', opacity: 0.7, transition: 'flex .5s' }} />
                  )}
                </div>
              </div>

              {/* P/C ratio explainer */}
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)' }}>
                {display.putCallRatio > 1.5
                  ? '⚠ High P/C ratio — more puts than calls being bought. This means traders are paying to protect against a drop, often a bearish signal.'
                  : display.putCallRatio < 0.7
                  ? '✓ Low P/C ratio — more calls than puts being bought. Traders are betting on upside, often a bullish signal.'
                  : '● Neutral P/C ratio — balanced call and put activity. No strong directional conviction from options traders.'}
              </div>

              {/* Unusual activity summary */}
              {(display.unusualCalls?.length > 0 || display.unusualPuts?.length > 0) && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                    Unusual Activity Detected
                  </div>
                  {display.unusualCalls?.slice(0,2).map((c, i) => (
                    <div key={i} style={{ background: 'rgba(34,197,94,0.05)', border: '0.5px solid rgba(34,197,94,0.2)', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>★ Unusual CALL</span>
                      <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8 }}>${c.strike} strike · {c.expiryDate} · {fmt(c.volume)} vol · {c.volToOI}x OI ratio</span>
                    </div>
                  ))}
                  {display.unusualPuts?.slice(0,2).map((c, i) => (
                    <div key={i} style={{ background: 'rgba(239,68,68,0.05)', border: '0.5px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>★ Unusual PUT</span>
                      <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8 }}>${c.strike} strike · {c.expiryDate} · {fmt(c.volume)} vol · {c.volToOI}x OI ratio</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'calls' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 55px 55px 55px 1fr', gap: 6, marginBottom: 6 }}>
                {['Strike', 'Expiry', 'Volume', 'Vol/OI', 'Details'].map(h => (
                  <div key={h} style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.6px' }}>{h}</div>
                ))}
              </div>
              {(display.topCalls || []).map((c, i) => <ContractRow key={i} contract={c} type="CALL" />)}
              {!display.topCalls?.length && <div className="empty">No call data available.</div>}
            </div>
          )}

          {activeTab === 'puts' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 55px 55px 55px 1fr', gap: 6, marginBottom: 6 }}>
                {['Strike', 'Expiry', 'Volume', 'Vol/OI', 'Details'].map(h => (
                  <div key={h} style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.6px' }}>{h}</div>
                ))}
              </div>
              {(display.topPuts || []).map((c, i) => <ContractRow key={i} contract={c} type="PUT" />)}
              {!display.topPuts?.length && <div className="empty">No put data available.</div>}
            </div>
          )}

          {lastFetch && (
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 10, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
              Source: Yahoo Finance · {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · refreshes every 10 min
            </div>
          )}
        </>
      )}
    </div>
  );
}
