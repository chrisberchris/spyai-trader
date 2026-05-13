import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { market } from '../lib/api';

export default function LiveFeed({ snapshot }) {
  const [feed, setFeed] = useState([]);
  const [running, setRunning] = useState(true);
  const [stats, setStats] = useState({ hi: null, lo: null, ups: 0, dns: 0 });
  const intervalRef = useRef(null);
  const runningRef = useRef(true);

  useEffect(() => {
    if (snapshot?.price) {
      const initial = { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), price: snapshot.price };
      setFeed([initial]);
      setStats(s => ({ ...s, hi: snapshot.price, lo: snapshot.price }));
    }
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      if (!runningRef.current) return;
      try {
        const data = await market.snapshot();
        if (!data?.price) return;
        const tick = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          price: parseFloat(data.price.toFixed(2))
        };
        setFeed(prev => {
          const updated = [...prev, tick].slice(-120);
          return updated;
        });
        setStats(prev => {
          const newHi = prev.hi === null ? tick.price : Math.max(prev.hi, tick.price);
          const newLo = prev.lo === null ? tick.price : Math.min(prev.lo, tick.price);
          const prevPrice = prev.lastPrice ?? tick.price;
          return {
            hi: newHi,
            lo: newLo,
            ups: tick.price > prevPrice ? prev.ups + 1 : prev.ups,
            dns: tick.price < prevPrice ? prev.dns + 1 : prev.dns,
            lastPrice: tick.price
          };
        });
      } catch {}
    }, 15000);
    return () => clearInterval(intervalRef.current);
  }, []);

  function toggleFeed() {
    runningRef.current = !runningRef.current;
    setRunning(runningRef.current);
  }

  const change = feed.length > 1 ? feed[feed.length - 1].price - feed[0].price : 0;
  const currentPrice = feed.length ? feed[feed.length - 1].price : snapshot?.price;

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-title">SPY Live Price Feed</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
              ${currentPrice?.toFixed(2) ?? '—'}
            </div>
            <div className={`metric-sub ${change >= 0 ? 'up' : 'down'}`} style={{ fontSize: 14 }}>
              {change !== 0 ? `${change >= 0 ? '+' : ''}${change.toFixed(2)} this session` : 'Waiting for ticks...'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={toggleFeed}>
              {running ? '⏸ Pause' : '▶ Resume'}
            </button>
            <button className="btn" onClick={() => { setFeed([]); setStats({ hi: null, lo: null, ups: 0, dns: 0 }); }}>
              ↺ Reset
            </button>
          </div>
        </div>

        <div style={{ height: 280 }}>
          {feed.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={feed}>
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#555870' }} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#555870' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(2)}`} />
                <Tooltip formatter={v => [`$${v.toFixed(2)}`, 'SPY']} contentStyle={{ background: '#13151c', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 12 }} />
                <Line type="monotone" dataKey="price" stroke={change >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="loading-text">Streaming live data every 15 seconds... (free Polygon tier)</span>
            </div>
          )}
        </div>
      </div>

      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Session High</div>
          <div className="metric-value up">${stats.hi?.toFixed(2) ?? '—'}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Session Low</div>
          <div className="metric-value down">${stats.lo?.toFixed(2) ?? '—'}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Up Ticks</div>
          <div className="metric-value up">{stats.ups}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Down Ticks</div>
          <div className="metric-value down">{stats.dns}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Feed Log</div>
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Time</th><th>Price</th><th>Change</th></tr></thead>
            <tbody>
              {[...feed].reverse().map((tick, i, arr) => {
                const prev = arr[i + 1];
                const diff = prev ? tick.price - prev.price : 0;
                return (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{tick.time}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>${tick.price.toFixed(2)}</td>
                    <td className={diff > 0 ? 'up' : diff < 0 ? 'down' : 'neu'} style={{ fontFamily: 'var(--mono)' }}>
                      {diff !== 0 ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
