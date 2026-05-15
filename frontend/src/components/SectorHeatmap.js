import { useState, useEffect, useCallback } from 'react';
import { market } from '../lib/api';

const ROTATION_STYLES = {
  RISK_ON:       { label: 'Risk-On',       color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)',   icon: '▲▲', desc: 'Offensive sectors leading — bullish signal' },
  MILD_RISK_ON:  { label: 'Mild Risk-On',  color: '#22c55e', bg: 'rgba(34,197,94,0.05)',   border: 'rgba(34,197,94,0.2)',   icon: '▲',  desc: 'Slight rotation into offensive sectors'      },
  NEUTRAL:       { label: 'Neutral',       color: '#8b8fa8', bg: 'var(--color-background-secondary)', border: 'var(--color-border-tertiary)', icon: '●', desc: 'No clear rotation signal' },
  MILD_RISK_OFF: { label: 'Mild Risk-Off', color: '#f59e0b', bg: 'rgba(245,158,11,0.05)',  border: 'rgba(245,158,11,0.2)',  icon: '▼',  desc: 'Slight rotation into defensive sectors'      },
  RISK_OFF:      { label: 'Risk-Off',      color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',   icon: '▼▼', desc: 'Defensive sectors leading — bearish signal'  },
};

const TYPE_COLORS = {
  offensive: '#22c55e',
  defensive: '#ef4444',
  mixed:     '#f59e0b',
};

function SectorBar({ sector }) {
  const pct    = sector.changePct ?? 0;
  const color  = pct > 0 ? '#22c55e' : pct < 0 ? '#ef4444' : '#8b8fa8';
  const maxBar = 3; // ±3% fills the bar
  const barW   = Math.min(Math.abs(pct) / maxBar * 50, 50); // 50% = max bar width each side

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
      {/* Name */}
      <div style={{ width: 120, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{sector.name}</span>
        <span style={{ fontSize: 10, color: TYPE_COLORS[sector.type], marginLeft: 5 }}>
          {sector.type === 'offensive' ? '▲' : sector.type === 'defensive' ? '▼' : '●'}
        </span>
      </div>

      {/* Bar chart centered at 0 */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: 16, position: 'relative' }}>
        {/* Center line */}
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--color-border-tertiary)' }} />
        {/* Bar */}
        {pct !== 0 && (
          <div style={{
            position: 'absolute',
            left:  pct > 0 ? '50%' : `${50 - barW}%`,
            width: `${barW}%`,
            height: '100%',
            background: color,
            opacity: 0.75,
            borderRadius: 2,
            transition: 'width .4s'
          }} />
        )}
      </div>

      {/* Percentage */}
      <div style={{
        width: 52, textAlign: 'right', flexShrink: 0,
        fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)',
        color: sector.error ? '#8b8fa8' : color
      }}>
        {sector.error ? '—' : `${pct >= 0 ? '+' : ''}${pct}%`}
      </div>
    </div>
  );
}

export default function SectorHeatmap({ signalSectorData }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [view, setView]         = useState('heatmap'); // heatmap | leaders

  const fetchData = useCallback(async () => {
    try {
      const res = await market.sectors();
      setData(res);
      setLastFetch(new Date());
    } catch (err) {
      console.error('Sector fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const display  = signalSectorData || data;
  const sectors  = display?.sectors || [];
  const rotation = display?.rotation;
  const leaders  = display?.leaders  || [];
  const laggards = display?.laggards || [];
  const rs       = ROTATION_STYLES[rotation?.signal || 'NEUTRAL'];

  // Sort sectors by changePct for heatmap view
  const sorted = [...sectors].sort((a, b) => (b.changePct ?? -99) - (a.changePct ?? -99));

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Sector Rotation</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['heatmap', 'leaders'].map(v => (
            <button key={v} className="btn" onClick={() => setView(v)}
              style={{ padding: '4px 10px', fontSize: 11, background: view === v ? 'var(--color-background-secondary)' : 'transparent' }}>
              {v === 'heatmap' ? 'All' : 'Leaders'}
            </button>
          ))}
          <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={fetchData}>↺</button>
        </div>
      </div>

      {loading && !display ? (
        <div className="empty">Loading sector data...</div>
      ) : (
        <>
          {/* Rotation signal banner */}
          {rotation && (
            <div style={{
              background: rs.bg, border: `1px solid ${rs.border}`,
              borderRadius: 'var(--border-radius-md)', padding: '10px 14px', marginBottom: 14
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: rs.color }}>
                    {rs.icon} {rs.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {rs.desc}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                    Breadth: <span style={{ color: rotation.breadthPct >= 60 ? '#22c55e' : rotation.breadthPct <= 40 ? '#ef4444' : '#8b8fa8', fontWeight: 600 }}>
                      {rotation.breadthPct}%
                    </span>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {rotation.positiveCount}/{rotation.totalCount} positive
                  </div>
                  {rotation.confidenceModifier !== 0 && (
                    <div style={{ fontSize: 11, color: rotation.confidenceModifier > 0 ? '#22c55e' : '#ef4444', marginTop: 2 }}>
                      {rotation.confidenceModifier > 0 ? '+' : ''}{rotation.confidenceModifier} confidence
                    </div>
                  )}
                </div>
              </div>

              {/* Offensive vs Defensive bar */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 3 }}>
                  <span style={{ color: '#22c55e' }}>Offensive avg: {rotation.avgOffensive >= 0 ? '+' : ''}{rotation.avgOffensive}%</span>
                  <span style={{ color: '#ef4444' }}>Defensive avg: {rotation.avgDefensive >= 0 ? '+' : ''}{rotation.avgDefensive}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--color-background-secondary)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                  {rotation.avgOffensive > 0 && (
                    <div style={{ flex: Math.max(rotation.avgOffensive, 0.1), background: '#22c55e', transition: 'flex .5s' }} />
                  )}
                  <div style={{ flex: Math.abs(rotation.strength) < 0.1 ? 0.5 : 0, background: '#8b8fa8' }} />
                  {rotation.avgDefensive > 0 && (
                    <div style={{ flex: Math.max(rotation.avgDefensive, 0.1), background: '#ef4444', transition: 'flex .5s' }} />
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'heatmap' ? (
            <div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: 10, color: 'var(--color-text-secondary)' }}>
                <span><span style={{ color: '#22c55e' }}>▲</span> Offensive</span>
                <span><span style={{ color: '#ef4444' }}>▼</span> Defensive</span>
                <span><span style={{ color: '#f59e0b' }}>●</span> Mixed</span>
              </div>
              {sorted.map(s => <SectorBar key={s.symbol} sector={s} />)}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.7px' }}>
                Leading Sectors
              </div>
              {leaders.map(s => <SectorBar key={s.symbol} sector={s} />)}
              <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: '.7px' }}>
                Lagging Sectors
              </div>
              {laggards.map(s => <SectorBar key={s.symbol} sector={s} />)}
            </div>
          )}

          {lastFetch && (
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 10, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
              Updated {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · auto-refreshes every 5 min
            </div>
          )}
        </>
      )}
    </div>
  );
}
