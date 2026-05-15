import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { signals, market } from '../lib/api';
import NewsSentiment from '../components/NewsSentiment';
import MultiTimeframe from '../components/MultiTimeframe';
import VolumeConfirmation from '../components/VolumeConfirmation';
import PreMarket from '../components/PreMarket';
import SectorHeatmap from '../components/SectorHeatmap';
import ConfidenceScore from '../components/ConfidenceScore';
import OptionsFlow from '../components/OptionsFlow';
import TookThisTrade from '../components/TookThisTrade';

export default function Dashboard({ snapshot }) {
  const [signal, setSignal] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [priceHistory, setPriceHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    signals.latest().then(setSignal).catch(() => {});
    market.prices(100).then(rows => {
      setPriceHistory(rows.map(r => ({
        time: new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        price: parseFloat(r.price)
      })));
    }).catch(() => {});
  }, []);

  async function runAnalysis() {
    setAnalyzing(true);
    setError(null);
    try {
      const data = await signals.generate();
      setSignal(data);
    } catch (err) {
      setError('Analysis failed. Check your API keys and try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  const change = snapshot ? snapshot.price - (snapshot.prevClose || snapshot.open || snapshot.price) : 0;
  const changePct = snapshot?.prevClose ? (change / snapshot.prevClose) * 100 : 0;
  const vix = snapshot?.vix;

  const sigClass = signal?.signal === 'BUY' ? 'buy' : signal?.signal === 'SELL' ? 'sell' : '';

  return (
    <div>
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">SPY Price</div>
          <div className="metric-value">${snapshot?.price?.toFixed(2) ?? '—'}</div>
          <div className={`metric-sub ${change >= 0 ? 'up' : 'down'}`}>
            {snapshot ? `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)` : '—'}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Day Range</div>
          <div className="metric-value" style={{ fontSize: 14, paddingTop: 5 }}>
            ${snapshot?.low?.toFixed(2) ?? '—'} – ${snapshot?.high?.toFixed(2) ?? '—'}
          </div>
          <div className="metric-sub neu">Hi / Lo</div>
        </div>
        <div className="metric">
          <div className="metric-label">Volume</div>
          <div className="metric-value" style={{ fontSize: 16, paddingTop: 4 }}>
            {snapshot?.volume ? (snapshot.volume / 1e6).toFixed(1) + 'M' : '—'}
          </div>
          <div className="metric-sub neu">shares today</div>
        </div>
        <div className="metric">
          <div className="metric-label">VIX Fear</div>
          <div className="metric-value">{vix ?? '—'}</div>
          <div className={`metric-sub ${vix < 15 ? 'up' : vix > 22 ? 'down' : 'neu'}`}>
            {vix ? (vix < 15 ? 'Low fear' : vix > 22 ? 'High fear' : 'Moderate') : '—'}
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">AI Signal</div>

          <div className={`sig-box ${sigClass}`}>
            <div className={`sig-tag ${sigClass}`}>
              {signal ? `${signal.signal === 'BUY' ? '🟢' : signal.signal === 'SELL' ? '🔴' : '🟡'} ${signal.signal} Signal` : 'Awaiting analysis'}
            </div>
            <div className="sig-action">{signal?.signal ?? '—'}</div>
            <div className="sig-text">
              {signal?.reasoning ?? 'Press "Run AI Analysis" to get your buy/sell/hold recommendation with full reasoning.'}
            </div>
            {signal && (
              <div>
                <div className="conf-row">
                  <span>Confidence</span>
                  <span>{signal.confidence}%</span>
                </div>
                <div className="cbar">
                  <div className={`cfill ${sigClass || 'neu'}`} style={{ width: `${signal.confidence}%` }} />
                </div>
              </div>
            )}
          </div>

          {signal && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14, fontSize: 12, fontFamily: 'var(--mono)' }}>
              <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ color: 'var(--text3)', marginBottom: 2 }}>Entry</div>
                <div>${signal.entry_price?.toFixed(2) ?? '—'}</div>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ color: 'var(--text3)', marginBottom: 2 }}>Target</div>
                <div className="up">${signal.target_price?.toFixed(2) ?? '—'}</div>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ color: 'var(--text3)', marginBottom: 2 }}>Stop Loss</div>
                <div className="down">${signal.stop_loss?.toFixed(2) ?? '—'}</div>
              </div>
            </div>
          )}

          <div style={{ height: 200, marginBottom: 14 }}>
            {priceHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceHistory}>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#555870' }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#555870' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(0)}`} />
                  <Tooltip formatter={v => [`$${v.toFixed(2)}`, 'SPY']} contentStyle={{ background: '#13151c', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 12 }} />
                  <Line type="monotone" dataKey="price" stroke={change >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="loading-text">Price history loads after first data fetch...</span>
              </div>
            )}
          </div>

          {signal?.indicators && (
            <div className="ind-grid">
              <div className="ind">
                <div className="ind-name">RSI (14)</div>
                <div className="ind-val">{signal.indicators.rsi ?? '—'}</div>
                <div className={`ind-st ${signal.indicators.rsi < 40 ? 'up' : signal.indicators.rsi > 65 ? 'down' : 'neu'}`}>
                  {signal.indicators.rsi < 40 ? 'Oversold' : signal.indicators.rsi > 65 ? 'Overbought' : 'Neutral'}
                </div>
              </div>
              <div className="ind">
                <div className="ind-name">MACD</div>
                <div className="ind-val">{signal.indicators.macd?.toFixed(2) ?? '—'}</div>
                <div className={`ind-st ${signal.indicators.macd > 0.3 ? 'up' : signal.indicators.macd < -0.3 ? 'down' : 'neu'}`}>
                  {signal.indicators.macd > 0.3 ? 'Bullish' : signal.indicators.macd < -0.3 ? 'Bearish' : 'Neutral'}
                </div>
              </div>
              <div className="ind">
                <div className="ind-name">MA Cross</div>
                <div className="ind-val">{signal.indicators.maCrossover === 'golden' ? 'Golden' : signal.indicators.maCrossover === 'death' ? 'Death' : '—'}</div>
                <div className={`ind-st ${signal.indicators.maCrossover === 'golden' ? 'up' : signal.indicators.maCrossover === 'death' ? 'down' : 'neu'}`}>
                  {signal.indicators.maCrossover === 'golden' ? '50 > 200 ✓' : signal.indicators.maCrossover === 'death' ? '50 < 200 ✗' : 'Calculating...'}
                </div>
              </div>
            </div>
          )}

          <ConfidenceScore confidenceScore={signal?.confidenceScore} signal={signal?.signal} />

          <MultiTimeframe mtf={signal?.mtf} />

          <VolumeConfirmation volumeAnalysis={signal?.volumeAnalysis} />

          {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <button className="btn btn-full btn-green" onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? 'Analyzing...' : '🧠 Run AI Analysis ↗'}
          </button>

          <TookThisTrade signal={signal} onLogged={() => {}} />
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title">Options Recommendations</div>
            {signal?.options?.length ? (
              <>
                {signal.options.map((o, i) => (
                  <div className="opt-card" key={i}>
                    <div className={`opt-type ${o.type?.toLowerCase()}`}>{o.type === 'CALL' ? '▲' : '▼'} {o.type}</div>
                    <div className="opt-detail">${o.strike} · {o.expiry}</div>
                    <div className="opt-sub">{o.rationale}</div>
                  </div>
                ))}
              </>
            ) : (
              <div className="empty">Run analysis to see call/put recommendations.</div>
            )}
          </div>

          <OptionsFlow signalOptionsFlow={signal?.optionsFlow} />

          <PreMarket signalPreMarket={signal?.preMarket} signalFutures={signal?.futures} />

          <SectorHeatmap signalSectorData={signal?.sectorData} />

          <NewsSentiment signalNewsData={signal?.newsData ? { ...signal.newsData, news_impact: signal.news_impact, news_summary: signal.news_summary } : null} />
        </div>
      </div>
    </div>
  );
}
