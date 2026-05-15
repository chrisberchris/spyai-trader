const POSITION_STYLES = {
  FULL:     { label: 'Full Position',     pct: '100%', color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)',   desc: 'Strong signal — use your planned full position size' },
  STANDARD: { label: 'Standard Position', pct: '75%',  color: '#22c55e', bg: 'rgba(34,197,94,0.05)',   border: 'rgba(34,197,94,0.2)',   desc: 'Good signal — use 75% of your planned position size' },
  REDUCED:  { label: 'Reduced Position',  pct: '50%',  color: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.25)', desc: 'Mixed signals — use only 50% of planned position size' },
  SMALL:    { label: 'Small Position',    pct: '25%',  color: '#f59e0b', bg: 'rgba(245,158,11,0.04)',  border: 'rgba(245,158,11,0.2)',  desc: 'Weak signal — use only 25% if you trade at all' },
  AVOID:    { label: 'Avoid Trade',       pct: '0%',   color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',   desc: 'Too many negative factors — skip this trade' },
};

const CATEGORY_COLORS = {
  risk:      '#3b82f6',
  volume:    '#8b5cf6',
  mtf:       '#22c55e',
  sectors:   '#f59e0b',
  premarket: '#06b6d4',
  news:      '#ec4899',
  calendar:  '#ef4444',
  options:   '#a855f7',
};

const CATEGORY_LABELS = {
  risk:      'Market Risk',
  volume:    'Volume',
  mtf:       'Timeframes',
  sectors:   'Sectors',
  premarket: 'Pre-Market',
  news:      'News',
  calendar:  'Calendar',
  options:   'Options Flow',
};

export default function ConfidenceScore({ confidenceScore, signal }) {
  if (!confidenceScore) {
    return (
      <div className="card">
        <div className="card-title">Confidence Score</div>
        <div className="empty">Run AI Analysis to see auto-scaled confidence breakdown.</div>
      </div>
    );
  }

  const { base, adjusted, totalModifier, modifiers, positionSize } = confidenceScore;
  const ps = POSITION_STYLES[positionSize] || POSITION_STYLES.AVOID;
  const sigColor = signal === 'BUY' ? '#22c55e' : signal === 'SELL' ? '#ef4444' : '#8b8fa8';

  // Group modifiers by category
  const grouped = modifiers.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <div className="card">
      <div className="card-title">Confidence Score</div>

      {/* Main score display */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {/* Big score circle */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
          background: `conic-gradient(${sigColor} ${adjusted}%, var(--color-background-secondary) 0%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative'
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--color-background-primary)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: sigColor, lineHeight: 1 }}>
              {adjusted}
            </div>
            <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', marginTop: 1 }}>/ 95</div>
          </div>
        </div>

        {/* Score details */}
        <div style={{ flex: 1 }}>
          <div style={{
            background: ps.bg, border: `1px solid ${ps.border}`,
            borderRadius: 'var(--border-radius-md)', padding: '8px 12px', marginBottom: 8
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: ps.color }}>{ps.label} — {ps.pct}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{ps.desc}</div>
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', display: 'flex', gap: 12 }}>
            <span>Base: <strong style={{ color: 'var(--color-text-primary)' }}>{base}</strong></span>
            <span>Modifiers: <strong style={{ color: totalModifier >= 0 ? '#22c55e' : '#ef4444' }}>{totalModifier >= 0 ? '+' : ''}{totalModifier}</strong></span>
            <span>Final: <strong style={{ color: sigColor }}>{adjusted}</strong></span>
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ height: 8, background: 'var(--color-background-secondary)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
          {/* Base confidence */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${base}%`, background: 'var(--color-border-secondary)', borderRadius: 4 }} />
          {/* Adjusted confidence */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${adjusted}%`, background: sigColor, borderRadius: 4, opacity: 0.8, transition: 'width .5s' }} />
          {/* Threshold markers */}
          {[55, 65, 75, 85].map(t => (
            <div key={t} style={{ position: 'absolute', left: `${t}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.3)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--color-text-secondary)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
          <span>Avoid</span><span>Small</span><span>Reduced</span><span>Standard</span><span>Full</span>
        </div>
      </div>

      {/* Modifier breakdown */}
      {modifiers.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            Applied Modifiers
          </div>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: CATEGORY_COLORS[category], fontWeight: 600, marginBottom: 3 }}>
                {CATEGORY_LABELS[category] || category}
              </div>
              {items.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 10px', background: 'var(--color-background-secondary)',
                  borderRadius: 4, marginBottom: 2,
                  borderLeft: `2px solid ${CATEGORY_COLORS[category]}`
                }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{m.label}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
                    color: m.value >= 0 ? '#22c55e' : '#ef4444'
                  }}>
                    {m.value >= 0 ? '+' : ''}{m.value}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {modifiers.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
          No modifiers applied — neutral market conditions.
        </div>
      )}
    </div>
  );
}
