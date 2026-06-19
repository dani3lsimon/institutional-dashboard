import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [message, setMessage]   = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email for confirmation link.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin(data.user);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-sm p-8 bg-slate-800/60 rounded-xl border border-slate-700 shadow-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-3xl font-black text-blue-400 tracking-wider mb-1">INSTITUTIONAL</div>
          <div className="text-sm text-slate-500 tracking-widest uppercase">AI Trading Analytics</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 tracking-wider mb-1 uppercase">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-200
                         focus:outline-none focus:border-blue-500 transition-colors text-sm"
              placeholder="you@email.com"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 tracking-wider mb-1 uppercase">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-200
                         focus:outline-none focus:border-blue-500 transition-colors text-sm"
              placeholder="Min 6 characters"
            />
          </div>

          {error && <div className="text-red-400 text-sm bg-red-400/10 p-2 rounded">{error}</div>}
          {message && <div className="text-green-400 text-sm bg-green-400/10 p-2 rounded">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500
                       text-white font-bold rounded-lg transition-colors text-sm tracking-wider uppercase"
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
            className="text-slate-500 hover:text-blue-400 text-xs tracking-wider transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
}
