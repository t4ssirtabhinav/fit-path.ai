import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Dumbbell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // The reset link establishes a recovery session via the URL hash —
    // give the client a moment to pick it up before checking.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasRecoverySession(true);
      setCheckingSession(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    navigate('/login', { state: { message: 'Your password has been reset. Please sign in.' } });
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Link expired</h1>
          <p className="text-gray-400 text-sm mb-8">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link to="/forgot-password" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors text-sm">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 rounded-2xl mb-4">
            <Dumbbell className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">FitPath</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Set a new password</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                label="New password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                hint="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-8 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Input
              label="Confirm new password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />

            <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
              Reset password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
