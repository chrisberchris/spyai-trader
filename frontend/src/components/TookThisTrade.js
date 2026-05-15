import { useState } from 'react';
import { personalTrades } from '../lib/api';

const EMOTION_LABELS = {
  1: '😰 Very fearful',
  2: '😟 Uncertain',
  3: '😐 Neutral',
  4: '😊 Confident',
  5: '💪 Very confident',
};

export default function TookThisTrade({ signal, onLogged }) {
  const [open, setOpen]           = useState(false);
  const [logged, setLogged]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const [side, setSide]                 = useState(signal?.signal === 'SELL' ? 'SELL' : 'BUY');
  const [tradeType, setTradeType]       = useState('STOCK');
  const [quantity, setQuantity]         = useState(1);
  const [entryPrice, setEntryPrice]     = useState(signal?.entry_price || '');
  const [targetPrice, setTargetPrice]   = useState(signal?.target_price || '');
  const [stopLoss, setStopLoss]         = useState(signal?.stop_loss || '');
  const [followedSignal, setFollowedSignal] = useState(true);
  const [deviationNotes, setDeviationNotes] = useState('');
  const [emotionRating, setEmotionRating] = useState(3);
  const [notes, setNotes]               = useState('');

  if (!signal || signal.signal === 'HOLD') return null;
  if (logged) return (
    <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '0.5px solid rgba(34,197,94,0.3)', borderRadius: 'var(--border-radius-md)', fontSize: 13, color: '#22c55e', fontWeight: 500 }}>
      ✓ Trade logged to your journal
    </div>
  );

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      await personalTrades.create({
        signal_id:       signal.signalId,
        side,
        trade_type:      tradeType,
        quantity:        parseInt(quantity),
        entry_price:     parseFloat(entryPrice),
        target_price:    parseFloat(targetPrice) || null,
        stop_loss:       parseFloat(stopLoss) || null,
        followed_signal: followedSignal,
        deviation_notes: deviationNotes || null,
        emotion_rating:  emotionRating,
        notes:           notes || null,
      });
      setLogged(true);
      setOpen(false);
      onLogged?.();
    } catch (err) {
      setError('Failed to log trade. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      {!open ? (
        <button
          className="btn btn-full"
          onClick={() => setOpen(true)}
          style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)', color: '#22c55e', fontWeight: 600 }}
        >
          📝 I took this trade — log it
        </button>
      ) : (
        <div style={{ background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-lg)', padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 14 }}>
            Log your trade
          </div>

          {/* Side + Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Side</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['BUY', 'SELL'].map(s => (
                  <button key={s} onClick={() => setSide(s)}
                    style={{ flex: 1, padding: '7px', fontSize: 12, fontWeight: 600, border: '0.5px solid', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', background: side === s ? (s === 'BUY' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)') : 'var(--color-background-primary)', borderColor: side === s ? (s === 'BUY' ? '#22c55e' : '#ef4444') : 'var(--color-border-tertiary)', color: side === s ? (s === 'BUY' ? '#22c55e' : '#ef4444') : 'var(--color-text-secondary)' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Type</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['STOCK', 'CALL', 'PUT'].map(t => (
                  <button key={t} onClick={() => setTradeType(t)}
                    style={{ flex: 1, padding: '7px', fontSize: 11, fontWeight: 500, border: '0.5px solid', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', background: tradeType === t ? 'var(--color-background-primary)' : 'transparent', borderColor: tradeType === t ? 'var(--color-border-secondary)' : 'var(--color-border-tertiary)', color: tradeType === t ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Prices + Quantity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              ['Qty', quantity, setQuantity, 'number', '1'],
              ['Entry $', entryPrice, setEntryPrice, 'number', '0.00'],
              ['Target $', targetPrice, setTargetPrice, 'number', '0.00'],
              ['Stop $', stopLoss, setStopLoss, 'number', '0.00'],
            ].map(([label, val, setter, type, placeholder]) => (
              <div key={label}>
                <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>{label}</label>
                <input type={type} value={val} onChange={e => setter(e.target.value)} placeholder={placeholder} step="0.01"
                  style={{ width: '100%', padding: '7px 8px', background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }} />
              </div>
            ))}
          </div>

          {/* Followed signal? */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>Did you follow the AI signal exactly?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[true, false].map(v => (
                <button key={String(v)} onClick={() => setFollowedSignal(v)}
                  style={{ flex: 1, padding: '7px', fontSize: 12, border: '0.5px solid', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', background: followedSignal === v ? 'var(--color-background-primary)' : 'transparent', borderColor: followedSignal === v ? 'var(--color-border-secondary)' : 'var(--color-border-tertiary)', color: followedSignal === v ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                  {v ? 'Yes — followed it' : 'No — I deviated'}
                </button>
              ))}
            </div>
            {!followedSignal && (
              <textarea value={deviationNotes} onChange={e => setDeviationNotes(e.target.value)}
                placeholder="Why did you deviate? (e.g. entered late, used smaller size, ignored stop)"
                rows={2}
                style={{ width: '100%', marginTop: 6, padding: '8px 10px', background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', fontSize: 12, color: 'var(--color-text-primary)', resize: 'vertical', fontFamily: 'var(--font-sans)' }} />
            )}
          </div>

          {/* Emotion rating */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
              How confident did you feel entering this trade?
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setEmotionRating(n)}
                  style={{ flex: 1, padding: '8px 4px', fontSize: 11, border: '0.5px solid', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', background: emotionRating === n ? 'var(--color-background-primary)' : 'transparent', borderColor: emotionRating === n ? 'var(--color-border-secondary)' : 'var(--color-border-tertiary)', color: emotionRating === n ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', textAlign: 'center' }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4, textAlign: 'center' }}>
              {EMOTION_LABELS[emotionRating]}
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any thoughts on this trade..."
              rows={2}
              style={{ width: '100%', padding: '8px 10px', background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', fontSize: 12, color: 'var(--color-text-primary)', resize: 'vertical', fontFamily: 'var(--font-sans)' }} />
          </div>

          {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setOpen(false)} style={{ flex: 1 }}>Cancel</button>
            <button className="btn" onClick={handleSubmit} disabled={loading || !entryPrice}
              style={{ flex: 2, background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)', color: '#22c55e', fontWeight: 600 }}>
              {loading ? 'Saving...' : '✓ Log trade'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
