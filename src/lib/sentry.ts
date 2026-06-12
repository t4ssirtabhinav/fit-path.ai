import * as Sentry from '@sentry/react';

// No-op if VITE_SENTRY_DSN isn't configured (e.g. local dev) — Sentry's SDK
// methods become safe no-ops when uninitialized.
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
