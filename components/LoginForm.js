/**
 * Login/Register Form Component
 */
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginForm({ onSuccess }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // Validation
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        // Use AuthContext signUp
        const { error: signUpError } = await signUp(email, password);

        if (signUpError) {
          setError(signUpError.message || 'Registration failed');
          return;
        }

        setMessage('Account created! Please check your email to confirm your account.');
        setMode('login');
      } else {
        // Use AuthContext signIn - this properly sets the session in localStorage
        const { data, error: signInError } = await signIn(email, password);

        if (signInError) {
          setError(signInError.message || 'Login failed');
          return;
        }

        // Login successful - AuthContext will update the user state
        // The onAuthStateChange listener will trigger and update the UI
        if (onSuccess) {
          onSuccess(data);
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="bg-dark-surface rounded-lg p-8 shadow-lg">
        <h2 className="text-2xl font-bold text-dark-text mb-6 text-center">
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            {message}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-dark-textMuted mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg
                         text-dark-text focus:outline-none focus:ring-2 focus:ring-dark-accent"
              placeholder="you@example.com"
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-dark-textMuted mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg
                         text-dark-text focus:outline-none focus:ring-2 focus:ring-dark-accent"
              placeholder="••••••••"
              disabled={loading}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-dark-textMuted mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg
                           text-dark-text focus:outline-none focus:ring-2 focus:ring-dark-accent"
                placeholder="••••••••"
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 py-2 px-4 bg-dark-accent hover:bg-dark-accent/80
                     text-white font-medium rounded-lg transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {mode === 'login' ? 'Signing in...' : 'Creating account...'}
            </span>
          ) : (
            mode === 'login' ? 'Sign In' : 'Create Account'
          )}
        </button>

        <div className="mt-4 text-center text-sm text-dark-textMuted">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setMessage(null);
                }}
                className="text-dark-accent hover:underline"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setMessage(null);
                }}
                className="text-dark-accent hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
