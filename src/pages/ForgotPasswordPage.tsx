import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LegalFooter } from '../components/layout/LegalFooter';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Always show a neutral confirmation, regardless of whether the email
    // exists or the call errors — avoids leaking which emails are registered.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 rounded-2xl mb-5">
            <Mail className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Check your inbox</h1>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            If an account exists for <span className="text-white font-medium">{email}</span>, we've sent a link to reset your password.
          </p>
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors text-sm">
            Back to sign in
          </Link>
          <div className="mt-8">
            <LegalFooter />
          </div>
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
          <h2 className="text-xl font-semibold text-white mb-2">Reset your password</h2>
          <p className="text-gray-400 text-sm mb-6">
            Enter your email and we'll send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />

            <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
              Send reset link
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Back to sign in
            </Link>
          </p>
        </div>

        <div className="mt-6">
          <LegalFooter />
        </div>
      </div>
    </div>
  );
}
