import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Dumbbell, ShieldCheck, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

function EmailSentScreen({ email, onResend, resending }: {
  email: string;
  onResend: () => void;
  resending: boolean;
}) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 rounded-2xl mb-5">
          <Mail className="w-7 h-7 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Check your inbox</h1>
        <p className="text-gray-400 text-sm mb-1">
          We sent a verification link to
        </p>
        <p className="text-white font-medium mb-6">{email}</p>
        <p className="text-gray-500 text-xs mb-8 leading-relaxed">
          Click the link in the email to verify your account and start your journey.
          The link expires in 24 hours.
        </p>
        <button
          onClick={onResend}
          disabled={resending}
          className="text-sm text-emerald-400 hover:text-emerald-300 disabled:text-gray-600 transition-colors"
        >
          {resending ? 'Sending…' : "Didn't get it? Resend email"}
        </button>
        <p className="text-center text-sm text-gray-500 mt-8">
          Already verified?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) { setError('You must accept the disclaimer to continue.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setEmailSent(true);
    }
  }

  async function resendVerification() {
    setResending(true);
    await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
  }

  async function handleGoogle() {
    if (!agreed) { setError('Please accept the medical disclaimer before continuing.'); return; }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'openid profile email',
        queryParams: { access_type: 'online', prompt: 'select_account' },
      },
    });
  }

  if (emailSent) {
    return <EmailSentScreen email={email} onResend={resendVerification} resending={resending} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 rounded-2xl mb-4">
            <Dumbbell className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">FitPath</h1>
          <p className="text-gray-400 mt-1">Create your free account</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Get started</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-5">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Medical disclaimer — must agree before any signup method */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-300 font-medium mb-1">Medical Disclaimer</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  FitPath provides general fitness and nutrition guidance only. This is <strong className="text-gray-300">not medical advice</strong>. Always consult a qualified healthcare professional before starting any diet, supplement, or exercise programme, especially if you have existing health conditions.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span className="text-xs text-gray-300">I understand and agree to the disclaimer above</span>
            </label>
          </div>

          {/* Google SSO — shown first for frictionless signup */}
          <Button
            variant="secondary"
            className="w-full mb-5"
            onClick={handleGoogle}
            disabled={!agreed}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">or sign up with email</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Arjun Sharma"
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
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

            <Button type="submit" className="w-full mt-2" size="lg" loading={loading} disabled={!agreed}>
              Create my account
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
