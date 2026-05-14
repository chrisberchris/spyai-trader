import { useState, useEffect, useCallback } from 'react';
import Dashboard from './pages/Dashboard';
import LiveFeed from './pages/LiveFeed';
import TradeLog from './pages/TradeLog';
import Backtest from './pages/Backtest';
import AuthPage from './pages/AuthPage';
import NewsSentiment from './components/NewsSentiment';
import SectorHeatmap from './components/SectorHeatmap';
import OptionsFlow from './components/OptionsFlow';
import { market } from './lib/api';
import { auth } from './lib/supabase';
import './App.css';

const TABS = [
  { id: 'dashboard', label: 'Dashboard',   icon: '◈' },
  { id: 'options',   label: 'Options Flow', icon: '◉' },
  { id: 'news',      label: 'News',         icon: '◎' },
  { id: 'sectors',   label: 'Sectors',      icon: '⬡' },
  { id: 'feed',      label: 'Live Feed',    icon: '≋' },
  { id: 'trades',    label: 'Trade Log',    icon: '≡' },
  { id: 'backtest',  label: 'Backtest',     icon: '▦' },
];

export default function App() {
  const [tab, setTab]           = useState('dashboard');
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [session, setSession]   = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Listen for auth state changes
  useEffect(() => {
    auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = auth.onAuthChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchSnapshot = useCallback(async () => {
    try {
      const data = await market.snapshot();
      setSnapshot(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Snapshot fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 30000);
    return () => clearInterval(interval);
  }, [fetchSnapshot, session]);

  // Show blank while checking auth
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-tertiary)' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!session) return <AuthPage />;

  const change    = snapshot ? snapshot.price - (snapshot.prevClose || snapshot.open) : 0;
  const changePct = snapshot && snapshot.prevClose ? (change / snapshot.prevClose) * 100 : 0;
  const userEmail = session.user?.email || '';

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="logo">SPY<span className="logo-accent">AI</span></span>
          <span className="logo-sub">Trader</span>
        </div>
        <div className="header-center">
          {snapshot && (
            <div className="price-bar">
              <span className="price-sym">SPY</span>
              <span className="price-val">${snapshot.price?.toFixed(2)}</span>
              <span className={`price-chg ${change >= 0 ? 'up' : 'down'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className={`live-pill ${loading ? 'loading' : ''}`}>
            <span className="live-dot" />
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Connecting...'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </span>
            <button
              onClick={() => auth.signOut()}
              style={{ fontSize: 11, padding: '4px 10px', background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {tab === 'dashboard' && <Dashboard snapshot={snapshot} />}
        {tab === 'options'   && <div style={{ maxWidth: 800 }}><OptionsFlow /></div>}
        {tab === 'news'      && <div style={{ maxWidth: 800 }}><NewsSentiment /></div>}
        {tab === 'sectors'   && <div style={{ maxWidth: 800 }}><SectorHeatmap /></div>}
        {tab === 'feed'      && <LiveFeed snapshot={snapshot} />}
        {tab === 'trades'    && <TradeLog />}
        {tab === 'backtest'  && <Backtest />}
      </main>

      <footer className="footer">
        ⚠ For educational purposes only. Not financial advice. Options trading involves substantial risk of loss. Consult a licensed financial advisor before trading.
      </footer>
    </div>
  );
}
