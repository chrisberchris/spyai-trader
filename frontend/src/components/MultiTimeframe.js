const BIAS_STYLE = {
  BULLISH: { color: '#22c55e', icon: '▲', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)' },
  BEARISH: { color: '#ef4444', icon: '▼', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
  NEUTRAL: { color: '#8b8fa8', icon: '●', bg: 'var(--color-background-secondary)', border: 'var(--color-border-tertiary)' },
};

const AGREEMENT_STYLE = {
  FULL_BULL:   { label: 'Full Agreement — Bullish',  color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.3)'  },
  FULL_BEAR:   { label: 'Full Agreement — Bearish',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.3)'  },
  MOSTLY_BULL: { label: 'Mostly Bullish (2/3)',       color: '#22c55e', bg: 'rgba(34,197,94,0.05)',  border: 'rgba(34,197,94,0.2)'  },
  MOSTLY_BEAR: { label: 'Mostly Bearish (2/3)',       color: '#ef4444', bg: 'rgba(239,68,68,0.05)',  border: 'rgba(239,68,68,0.2)'  },
  MIXED:       { label: 'Mixed — Timeframes Conflict', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
};

function TimeframeRow({ label, data }) {
  if (!data?.sufficient) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', width: 60 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Insufficient data</span>
      </div>
    );
  }

  const bs = BIAS_STYLE[data.bias] || BIAS_STYLE.NEUTRAL;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', width: 55, flexShrink: 0 }}>{label}</span>

      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
        background: bs.bg, color: bs.color, border: `0.5px solid ${bs.border}`,
        fontFamily: 'var(--font-mono)', flexShrink: 0, width: 90, textAlign: 'center'
      }}>
        {bs.icon} {data.bias}
      </span>

      <div style={{ display: 'flex', gap: 12, flex: 1, justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 1 }}>RSI</div>
          <div style={{
            fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: data.rsi < 40 ? '#22c55e' : data.rsi > 65 ? '#ef4444' : 'var(--color-text-primary)'
          }}>
            {data.rsi?.toFixed(1) ?? '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 1 }}>MACD</div>
          <div style={{
            fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: data.macd > 0.2 ? '#22c55e' : data.macd < -0.2 ? '#ef4444' : 'var(--color-text-primary)'
          }}>
            {data.macd?.toFixed(2) ?? '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MultiTimeframe({ mtf }) {
  if (!mtf) {
    return (
      <div className="card">
        <div className="card-title">Multi-Timeframe Analysis</div>
        <div className="empty">Run AI Analysis to see timeframe breakdown.</div>
      </div>
    );
  }

  const ag = AGREEMENT_STYLE[mtf.agreement] || AGREEMENT_STYLE.MIXED;

  return (
    <div className="card">
      <div className="card-title">Multi-Timeframe Analysis</div>

      {/* Agreement banner */}
      <div style={{
        background: ag.bg, border: `1px solid ${ag.border}`,
        borderRadius: 'var(--border-radius-md)', padding: '10px 14px', marginBottom: 14,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: ag.color }}>{ag.label}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Confidence {mtf.confidenceModifier > 0 ? `+${mtf.confidenceModifier}` : mtf.confidenceModifier} pts from alignment
          </div>
        </div>
        <div style={{
          fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: ag.color
        }}>
          {mtf.agreement === 'FULL_BULL' || mtf.agreement === 'MOSTLY_BULL' ? '▲▲▲' :
           mtf.agreement === 'FULL_BEAR' || mtf.agreement === 'MOSTLY_BEAR' ? '▼▼▼' : '≈≈≈'}
        </div>
      </div>

      {/* Timeframe rows */}
      <div>
        <TimeframeRow label="Daily"  data={mtf.daily}  />
        <TimeframeRow label="Hourly" data={mtf.hourly} />
        <TimeframeRow label="15-min" data={mtf.m15}    />
      </div>

      {/* Explainer */}
      <div style={{
        marginTop: 12, fontSize: 11, color: 'var(--color-text-secondary)',
        lineHeight: 1.5, padding: '8px 10px',
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)'
      }}>
        {mtf.agreement === 'MIXED'
          ? '⚠ Timeframes are conflicting. The AI requires stronger conviction — consider waiting for alignment before trading.'
          : mtf.agreement.includes('FULL')
          ? '✓ All three timeframes agree. This is the strongest possible signal confirmation — highest conviction.'
          : '~ Two of three timeframes agree. Reasonable confirmation — proceed with standard position sizing.'}
      </div>
    </div>
  );
}
