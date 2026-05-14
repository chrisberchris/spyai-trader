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
  { id: 'dashboard', label: 'Signal',   icon: '◈' },
  { id: 'options',   label: 'Options',  icon: '◉' },
  { id: 'news',      label: 'News',     icon: '◎' },
  { id: 'sectors',   label: 'Sectors',  icon: '⬡' },
  { id: 'feed',      label: 'Feed',     icon: '≋' },
  { id: 'trades',    label: 'Trades',   icon: '≡' },
  { id: 'backtest',  label: 'Backtest', icon: '▦' },
];

export default function App() {
  const [tab, setTab]               = useState('dashboard');
  const [snapshot, setSnapshot]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [session, setSession]       = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

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

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show banner after 30s if not already installed
      setTimeout(() => setShowInstallBanner(true), 30000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Handle tab from URL query param (for PWA shortcuts)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t && TABS.find(tab => tab.id === t)) setTab(t);
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

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setInstallPrompt(null); setShowInstallBanner(false); }
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>Loading...</div>
      </div>
    );
  }

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
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`live-pill ${loading ? 'loading' : ''}`}>
            <span className="live-dot" />
            <span style={{ display: 'none' }} className="signout-label">
              {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Connecting...'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              className="signout-label">
              {userEmail}
            </span>
            <button
              onClick={() => auth.signOut()}
              style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text2)', cursor: 'pointer' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Desktop tab bar */}
      <nav className="tabs">
        {TABS.map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      {/* Install banner (Android Chrome) */}
      {showInstallBanner && installPrompt && (
        <div style={{ background: 'var(--bg2)', borderBottom: '0.5px solid var(--border)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            📱 Add SPY AI Trader to your home screen
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleInstall}
              style={{ fontSize: 12, padding: '5px 12px', background: 'var(--green)', border: 'none', borderRadius: 'var(--radius)', color: '#0d1a0d', cursor: 'pointer', fontWeight: 600 }}>
              Install
            </button>
            <button onClick={() => setShowInstallBanner(false)}
              style={{ fontSize: 12, padding: '5px 10px', background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text2)', cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="main">
        {/* Mobile price bar — shown instead of header price on small screens */}
        {snapshot && (
          <div className="mobile-price-bar" style={{ display: 'none' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>SPY</span>
            <span style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--mono)' }}>${snapshot.price?.toFixed(2)}</span>
            <span className={change >= 0 ? 'up' : 'down'} style={{ fontSize: 13, fontFamily: 'var(--mono)' }}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
            </span>
          </div>
        )}
        {tab === 'dashboard' && <Dashboard snapshot={snapshot} />}
        {tab === 'options'   && <div style={{ maxWidth: 800 }}><OptionsFlow /></div>}
        {tab === 'news'      && <div style={{ maxWidth: 800 }}><NewsSentiment /></div>}
        {tab === 'sectors'   && <div style={{ maxWidth: 800 }}><SectorHeatmap /></div>}
        {tab === 'feed'      && <LiveFeed snapshot={snapshot} />}
        {tab === 'trades'    && <TradeLog />}
        {tab === 'backtest'  && <Backtest />}
      </main>

      {/* Mobile bottom navigation */}
      <nav className="mobile-nav" aria-label="Main navigation">
        {TABS.map(t => (
          <button key={t.id} className={`mobile-nav-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="mobile-nav-icon" aria-hidden="true">{t.icon}</span>
            <span className="mobile-nav-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <footer className="footer">
        ⚠ For educational purposes only. Not financial advice. Options trading involves substantial risk of loss.
      </footer>
    </div>
  );
}
