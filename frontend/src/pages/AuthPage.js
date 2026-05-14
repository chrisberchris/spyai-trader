import { useState } from 'react';
import { auth } from '../lib/supabase';

export default function AuthPage() {
  const [mode, setMode]         = useState('login'); // login | signup | reset
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await auth.signIn(email, password);
        if (error) throw error;
        // App.js will detect the session change and show the dashboard

      } else if (mode === 'signup') {
        if (password !== confirm) throw new Error('Passwords do not match.');
        if (password.length < 8)  throw new Error('Password must be at least 8 characters.');
        const { error } = await auth.signUp(email, password);
        if (error) throw error;
        setSuccess('Account created! Check your email to confirm your address, then sign in.');
        setMode('login');

      } else if (mode === 'reset') {
        const { error } = await auth.resetPassword(email);
        if (error) throw error;
        setSuccess('Password reset email sent. Check your inbox.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-background-tertiary)', padding: '1rem'
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: -1 }}>
          SPY<span style={{ color: '#22c55e' }}>AI</span> Trader
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
          Institutional-grade signals for everyday traders
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)', padding: '2rem'
      }}>
        {/* Title */}
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
          {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 24 }}>
          {mode === 'login'  ? 'Welcome back.' :
           mode === 'signup' ? 'Start tracking your signals and trades.' :
           'Enter your email and we\'ll send a reset link.'}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
              Email address
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required autoComplete="email"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'} required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}
              />
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                Confirm password
              </label>
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password" required autoComplete="new-password"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}
              />
            </div>
          )}

          {error && (
            <div style={{ fontSize: 13, color: '#ef4444', padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: 'var(--border-radius-md)' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ fontSize: 13, color: '#22c55e', padding: '10px 12px', background: 'rgba(34,197,94,0.08)', border: '0.5px solid rgba(34,197,94,0.3)', borderRadius: 'var(--border-radius-md)' }}>
              {success}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '11px', marginTop: 4,
              background: loading ? 'var(--color-background-secondary)' : '#22c55e',
              border: 'none', borderRadius: 'var(--border-radius-md)',
              fontSize: 14, fontWeight: 600, color: loading ? 'var(--color-text-secondary)' : '#0d1a0d',
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all .15s',
              fontFamily: 'var(--font-sans)'
            }}
          >
            {loading ? 'Please wait...' :
             mode === 'login'  ? 'Sign in' :
             mode === 'signup' ? 'Create account' :
             'Send reset link'}
          </button>
        </form>

        {/* Mode switchers */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          {mode === 'login' && (
            <>
              <button onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
                style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                Forgot your password?
              </button>
              <button onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                style={{ background: 'none', border: 'none', fontSize: 13, color: '#22c55e', cursor: 'pointer', fontWeight: 500 }}>
                Don't have an account? Sign up
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              Already have an account? Sign in
            </button>
          )}
          {mode === 'reset' && (
            <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              Back to sign in
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', maxWidth: 360 }}>
        ⚠ For educational purposes only. Not financial advice. Options trading involves substantial risk.
      </div>
    </div>
  );
}
