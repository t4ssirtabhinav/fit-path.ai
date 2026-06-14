import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';

const STEPS = [
  'Analysing your health profile...',
  'Designing your Phase 1 workout split...',
  'Building your personalised meal plan...',
  'Selecting supplements for your goals...',
  'Creating daily habits and sleep protocol...',
  'Finalising your plan...',
];

export function GeneratePlanPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  // `user` gets a new object reference on every onAuthStateChange event
  // (INITIAL_SESSION, TOKEN_REFRESHED, etc.), and StrictMode double-invokes
  // effects in dev — without this guard, generate() fires multiple concurrent
  // requests per page visit, which is enough to exhaust the Gemini API's
  // per-minute rate limit on its own.
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!user || hasStartedRef.current) return;
    hasStartedRef.current = true;
    const userId = user.id;

    // Advance through steps every 3s, then pulse the last one until done
    const interval = setInterval(() => {
      setCurrentStep(s => (s < STEPS.length - 1 ? s + 1 : s));
    }, 3000);

    async function generate() {
      const { data: { session } } = await supabase.auth.getSession();
      let res: Response;
      try {
        res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-plan`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
              'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(75000),
          }
        );
      } catch (err) {
        clearInterval(interval);
        const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
        setError(isTimeout
          ? 'Plan generation timed out. This usually means the AI is under high load — please try again in a moment.'
          : 'Network error. Please check your connection and try again.'
        );
        return;
      }
      const result = await res.json();
      clearInterval(interval);
      if (!res.ok) {
        setError(result.error || 'Failed to generate plan. Please try again.');
      } else {
        // Mark onboarding complete only after plan is successfully generated
        await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', userId);
        await refreshProfile();
        setCurrentStep(STEPS.length - 1);
        setDone(true);
      }
    }

    generate();
    return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-6">
          {done ? (
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          ) : error ? (
            <AlertCircle className="w-8 h-8 text-red-400" />
          ) : (
            <Sparkles className="w-8 h-8 text-emerald-400 animate-pulse" />
          )}
        </div>

        {!error ? (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">
              {done ? 'Your plan is ready!' : 'Building your plan'}
            </h1>
            <p className="text-gray-400 text-sm mb-8">
              {done
                ? 'A personalised Phase 1 plan has been created just for you.'
                : 'This usually takes 30–60 seconds. Hang tight.'}
            </p>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 text-left space-y-3">
              {STEPS.map((step, i) => {
                const isComplete = i < currentStep || done;
                const isActive = i === currentStep && !done;
                const isLastAndWaiting = isActive && i === STEPS.length - 1;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                      isComplete
                        ? 'bg-emerald-500'
                        : isActive
                        ? 'border-2 border-emerald-500 animate-pulse'
                        : 'border-2 border-gray-700'
                    }`}>
                      {isComplete && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm transition-colors duration-300 ${
                      isComplete || isActive ? 'text-gray-200' : 'text-gray-600'
                    }`}>
                      {isLastAndWaiting ? `${step}…` : step}
                    </span>
                  </div>
                );
              })}
            </div>

            {done && (
              <Button onClick={() => navigate('/dashboard')} size="lg" className="w-full">
                <Sparkles className="w-4 h-4" />
                View my plan
              </Button>
            )}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-red-400 text-sm mb-8">{error}</p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => navigate('/onboarding')} className="flex-1">
                Back to onboarding
              </Button>
              <Button onClick={() => window.location.reload()} className="flex-1">
                Try again
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
