const VOLUME_STYLES = {
  VERY_HIGH: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)', label: 'Very High', icon: '▲▲' },
  HIGH:      { color: '#22c55e', bg: 'rgba(34,197,94,0.05)', border: 'rgba(34,197,94,0.2)', label: 'High',      icon: '▲'  },
  NORMAL:    { color: '#8b8fa8', bg: 'var(--color-background-secondary)', border: 'var(--color-border-tertiary)', label: 'Normal', icon: '●' },
  LOW:       { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', label: 'Low',      icon: '▼'  },
  VERY_LOW:  { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.3)',  label: 'Very Low', icon: '▼▼' },
  UNKNOWN:   { color: '#8b8fa8', bg: 'var(--color-background-secondary)', border: 'var(--color-border-tertiary)', label: 'Unknown', icon: '?' },
};

function fmt(n) {
  if (!n) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toString();
}

export default function VolumeConfirmation({ volumeAnalysis }) {
  if (!volumeAnalysis) {
    return (
      <div className="card">
        <div className="card-title">Volume Confirmation</div>
        <div className="empty">Run AI Analysis to see volume analysis.</div>
      </div>
    );
  }

  const vs = VOLUME_STYLES[volumeAnalysis.label] || VOLUME_STYLES.UNKNOWN;
  const barWidth = Math.min(Math.max((volumeAnalysis.pct || 0), 0), 200);

  return (
    <div className="card">
      <div className="card-title">Volume Confirmation</div>

      {/* Main badge */}
      <div style={{
        background: vs.bg, border: `1px solid ${vs.border}`,
        borderRadius: 'var(--border-radius-md)', padding: '10px 14px',
        marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: vs.color }}>
            {vs.icon} {vs.label} Volume
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {volumeAnalysis.pct}% of 20-day average
            {volumeAnalysis.confidenceModifier !== 0 && (
              <span style={{ marginLeft: 8, color: volumeAnalysis.confidenceModifier > 0 ? '#22c55e' : '#ef4444' }}>
                ({volumeAnalysis.confidenceModifier > 0 ? '+' : ''}{volumeAnalysis.confidenceModifier} confidence)
              </span>
            )}
          </div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, padding: '4px 10px',
          borderRadius: 4, background: volumeAnalysis.tradeable ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: volumeAnalysis.tradeable ? '#15803d' : '#b91c1c',
          fontFamily: 'var(--font-mono)'
        }}>
          {volumeAnalysis.tradeable ? '✓ Confirmed' : '✗ Unconfirmed'}
        </div>
      </div>

      {/* Volume bar vs average */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          <span>Today: {fmt(volumeAnalysis.current)}</span>
          <span>20-day avg: {fmt(volumeAnalysis.avg20)}</span>
        </div>

        {/* Bar showing today vs average — average line at 100% */}
        <div style={{ position: 'relative', height: 10, background: 'var(--color-background-secondary)', borderRadius: 5, overflow: 'visible' }}>
          {/* Fill bar */}
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${Math.min(barWidth / 2, 100)}%`,
            background: vs.color, borderRadius: 5, opacity: 0.8,
            transition: 'width .6s'
          }} />
          {/* Average line at 50% of bar (representing 100% of avg) */}
          <div style={{
            position: 'absolute', left: '50%', top: -3, bottom: -3,
            width: 2, background: 'var(--color-text-secondary)', borderRadius: 1
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 3 }}>
          <span>▲ average</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {[
          ['Today', fmt(volumeAnalysis.current)],
          ['20-day avg', fmt(volumeAnalysis.avg20)],
          ['5-day avg', fmt(volumeAnalysis.avg5)],
        ].map(([label, val]) => (
          <div key={label} style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Warning if low volume */}
      {volumeAnalysis.warning && (
        <div style={{
          marginTop: 12, fontSize: 11, color: '#f59e0b', lineHeight: 1.5,
          padding: '8px 10px', background: 'rgba(245,158,11,0.06)',
          borderRadius: 'var(--border-radius-md)', border: '0.5px solid rgba(245,158,11,0.25)'
        }}>
          ⚠ {volumeAnalysis.warning}
        </div>
      )}

      {/* Confirmation note */}
      {volumeAnalysis.tradeable && (
        <div style={{
          marginTop: 10, fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5,
          padding: '8px 10px', background: 'var(--color-background-secondary)',
          borderRadius: 'var(--border-radius-md)'
        }}>
          ✓ Volume is sufficient to confirm this signal. Strong volume behind a price move indicates institutional participation.
        </div>
      )}
    </div>
  );
}
