import { useState, useEffect, useCallback } from 'react';
import { news as newsApi } from '../lib/api';

const SENT_COLORS = {
  BULLISH:  { bg: '#dcfce7', fg: '#15803d', icon: '▲' },
  BEARISH:  { bg: '#fee2e2', fg: '#b91c1c', icon: '▼' },
  NEUTRAL:  { bg: '#f1f5f9', fg: '#475569', icon: '●' },
};

const IMPACT_COLORS = {
  CONFIRMING:    { bg: '#dcfce7', fg: '#15803d', label: '✓ Confirming signal' },
  CONTRADICTING: { bg: '#fee2e2', fg: '#b91c1c', label: '✗ Contradicting signal' },
  NEUTRAL:       { bg: '#fef9c3', fg: '#854d0e', label: '~ Neutral to signal' },
};

function SentimentBar({ bullish = 0, bearish = 0, neutral = 0 }) {
  const total = bullish + bearish + neutral || 1;
  const bPct  = Math.round(bullish  / total * 100);
  const rPct  = Math.round(bearish  / total * 100);
  const nPct  = Math.round(neutral  / total * 100);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
        <span className="up">▲ {bPct}% bullish</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>● {nPct}% neutral</span>
        <span className="down">▼ {rPct}% bearish</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--color-border-tertiary)', overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${bPct}%`, background: '#22c55e', transition: 'width .5s' }} />
        <div style={{ width: `${nPct}%`, background: '#94a3b8', transition: 'width .5s' }} />
        <div style={{ width: `${rPct}%`, background: '#ef4444', transition: 'width .5s' }} />
      </div>
    </div>
  );
}

function CalendarWarning({ events }) {
  if (!events?.length) return null;
  return (
    <div style={{
      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)',
      borderRadius: 'var(--border-radius-md)', padding: '10px 14px', marginBottom: 12
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>
        ⚠ High-Impact Events — Next 48 Hours
      </div>
      {events.map((e, i) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: i < events.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
          <span style={{ color: 'var(--color-text-primary)' }}>{e.event}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {new Date(e.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
      <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6, fontStyle: 'italic' }}>
        AI confidence is automatically reduced during high-impact event windows.
      </div>
    </div>
  );
}

export default function NewsSentiment({ signalNewsData }) {
  const [newsData, setNewsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const fetchNews = useCallback(async () => {
    try {
      const data = await newsApi.feed();
      setNewsData(data);
      setLastFetch(new Date());
    } catch (err) {
      console.error('News fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchNews]);

  // Use signal-embedded news data if available (fresher, already fetched)
  const display = signalNewsData || newsData;
  const articles = display?.articles || [];
  const overall  = display?.overall  || {};
  const calendar = display?.calendar || signalNewsData?.calendar || newsData?.calendar?.events || [];
  const source   = display?.source;
  const noKey    = display?.error?.includes('FINNHUB_API_KEY');

  if (loading) {
    return (
      <div className="card">
        <div className="card-title">Live News Sentiment</div>
        <div className="empty">Loading market news...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Live News Sentiment</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastFetch && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
              {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={fetchNews}>
            ↺
          </button>
        </div>
      </div>

      {noKey && (
        <div style={{ background: 'rgba(59,130,246,0.08)', border: '0.5px solid rgba(59,130,246,0.3)', borderRadius: 'var(--border-radius-md)', padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <strong style={{ color: '#3b82f6' }}>Add your Finnhub API key</strong> to enable live news. Get a free key at{' '}
          <a href="https://finnhub.io" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>finnhub.io</a>
          , then add <code style={{ background: 'var(--color-background-secondary)', padding: '1px 5px', borderRadius: 3 }}>FINNHUB_API_KEY</code> to your Render environment variables.
        </div>
      )}

      <CalendarWarning events={calendar} />

      {overall?.total > 0 && (
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: overall.label === 'BULLISH' ? '#22c55e' : overall.label === 'BEARISH' ? '#ef4444' : 'var(--color-text-secondary)' }}>
              {overall.label === 'BULLISH' ? '▲' : overall.label === 'BEARISH' ? '▼' : '●'} Overall: {overall.label}
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
              {overall.total} headlines analysed
            </span>
          </div>
          <SentimentBar bullish={overall.bullish} bearish={overall.bearish} neutral={overall.neutral} />
        </div>
      )}

      {signalNewsData?.news_impact && (
        <div style={{
          background: IMPACT_COLORS[signalNewsData.news_impact]?.bg,
          borderRadius: 'var(--border-radius-md)', padding: '8px 12px', marginBottom: 12,
          fontSize: 12, fontWeight: 600, color: IMPACT_COLORS[signalNewsData.news_impact]?.fg
        }}>
          {IMPACT_COLORS[signalNewsData.news_impact]?.label}
          {signalNewsData.news_summary && (
            <div style={{ fontWeight: 400, marginTop: 3, fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {signalNewsData.news_summary}
            </div>
          )}
        </div>
      )}

      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {articles.length === 0 ? (
          <div className="empty">
            {noKey ? 'Add Finnhub API key to see live headlines.' : 'No recent market headlines available.'}
          </div>
        ) : (
          articles.map((article, i) => {
            const colors = SENT_COLORS[article.sentiment] || SENT_COLORS.NEUTRAL;
            const isOpen = expanded === i;
            return (
              <div
                key={i}
                onClick={() => setExpanded(isOpen ? null : i)}
                style={{
                  padding: '10px 0', borderBottom: '0.5px solid var(--color-border-tertiary)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '2px 7px',
                    borderRadius: 4, background: colors.bg, color: colors.fg,
                    fontFamily: 'var(--font-mono)', marginTop: 1
                  }}>
                    {colors.icon} {article.sentiment}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.4, marginBottom: 3 }}>
                      {article.headline}
                    </div>
                    {isOpen && article.summary && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 4 }}>
                        {article.summary}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {article.source} · {new Date(article.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {article.url && (
                        <a href={article.url} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none' }}>
                          Read ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {source && source !== 'unavailable' && (
        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 8, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
          Source: {source === 'finnhub' ? 'Finnhub' : source} · auto-refreshes every 5 min
        </div>
      )}
    </div>
  );
}
