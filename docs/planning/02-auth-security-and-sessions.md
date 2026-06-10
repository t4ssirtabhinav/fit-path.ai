# Plan: Auth Hardening, Password Recovery & Session Management

Covers tickets **#2 (email verification), #3 (forgot password), #4 (reset password for logged-in users), #8 (session management)**.

**Important correction to the original ask**: the codebase audit shows email verification is *already implemented and required* — Supabase Auth sends a confirmation email on signup (`RegisterPage.tsx:68`), login is blocked with an "Email not confirmed" error until verified (`LoginPage.tsx:27-29`), and resend is available in both flows. So ticket #2 isn't "build it from scratch" — it's "hadn't realized it exists; now make sure it does the *job behind the request*", which on closer reading is really about three sub-problems: (a) rate-limiting resends, (b) handling expiry/re-verification gracefully, and (c) **not creating downstream records for unverified users**. That reframing is reflected below.

---

## 1. Email Verification — Closing the Real Gaps (Ticket #2)

### What already works
- Verification is mandatory before login (good — matches the "rate limiting / legitimate users only" goal already).
- Resend is available from both the login screen (when blocked) and the post-signup screen.

### The actual gap: data is created *before* verification
Per the audit, a `profiles` row is auto-created via a DB trigger the moment a row appears in `auth.users` — i.e., at signup, not at verification (`20260604125725_fix_handle_new_user_security.sql`). This directly contradicts the stated goal ("only if the user is verified should records be created... so we don't consume useless storage with blank data").

**Two ways to close this gap, in increasing order of complexity/risk:**

1. **Defer profile creation to first-login-after-verification** (recommended starting point): change the trigger to fire on `auth.users` *update* where `email_confirmed_at` transitions from null → not-null, rather than on insert. Supabase Auth already fires this transition naturally when the user clicks the verification link. This is a small migration change with no app-code impact, since `AuthContext` already re-fetches the profile on auth state changes — it would simply find "no profile yet" for an unverified user and could show a "please verify your email" state instead.
2. **Scheduled cleanup of unverified accounts**: a periodic job (Supabase cron / pg_cron, or an edge function on a schedule) that removes `auth.users` rows where `email_confirmed_at IS NULL` and `created_at` is older than N days (e.g. 7). This solves the "abandoned signup" storage question more completely but adds an operational dependency (a scheduled job that must be monitored) — better as a phase-2 addition once the simpler trigger change is in place and verified.

Either approach should be paired with: an explicit **"Verify your email to continue"** screen shown to authenticated-but-unverified users (instead of relying solely on the login-time block), so a user who somehow gets a session before verifying isn't stuck looking at a blank or broken app.

### Rate limiting resend / regeneration (the part of the ticket that's genuinely missing)
- Supabase Auth has *some* built-in rate limiting on `resend()`, but it's project-wide and not very visible to the end user. Add an **app-level cooldown**: after a resend, disable the button and show a countdown (e.g. 60s), persisted via a `localStorage` timestamp or a small `last_verification_sent_at` column so a page refresh can't bypass it.
- Cap total resends per signup window (e.g. 5 per 24 hours) — track via a counter column or a lightweight `verification_attempts` table keyed by user id, incremented on each resend, reset on successful verification.
- Show a clear, friendly message when the cap is hit ("You've requested several verification emails — check your spam folder, or contact support if you're still having trouble") rather than a hard dead-end.

### UX for expired links (the ticket's specific question)
Best-practice pattern, applicable to Supabase's link-based flow:
1. When a user clicks an expired verification link, Supabase redirects back with an error in the URL (e.g. `error=access_denied&error_code=otp_expired`). Detect this on the landing/callback route and show a dedicated **"This link has expired"** screen — not a generic error page.
2. That screen's primary action is "Send a new verification email" (subject to the same rate limit above), pre-filled with the email address if it's recoverable from the URL/session, or asking the user to re-enter it if not.
3. Frame it positively/normally — link expiry is routine, not a failure state. Avoid alarming language.
4. Consider shortening Supabase's default 24-hour expiry if abuse becomes a concern, but 24h is a reasonable, user-friendly default to keep initially.

---

## 2. Forgot Password (Ticket #3)

### Recommended approach: Supabase Auth's native password-recovery flow
This reuses the exact email-delivery infrastructure already proven to work for verification — no new email service needed, and it's free at current scale (Supabase's auth email sending is included).

**Flow:**
1. **"Forgot password?" link** on `LoginPage` → new `/forgot-password` route with an email input.
2. Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: <app-origin>/reset-password })`.
3. Show a neutral confirmation regardless of whether the email exists in the system — **"If an account exists for that address, we've sent a reset link"** — this is a standard anti-enumeration practice (don't reveal whether an email is registered).
4. User clicks the emailed link → lands on `/reset-password` with a recovery session established by Supabase → enters a new password (with the usual confirm-password + strength validation) → `supabase.auth.updateUser({ password })`.
5. On success, redirect to login with a success message; consider also signing out any other active sessions for that account as a security measure (Supabase supports this via `signOut({ scope: 'others' })` post-update... verify availability in the SDK version in use).

### Guardrails & abuse prevention (as the ticket asks)
- **Rate limit reset requests** the same way as verification resends: per-email cooldown + daily cap, with the same "neutral response" pattern so an attacker can't use response timing/content to enumerate accounts or trigger spam against a victim's inbox.
- **Expiry handling**: same pattern as verification links — detect expired/invalid recovery tokens and show a "this link has expired, request a new one" screen rather than a raw error.
- **Post-reset notification**: send (or rely on Supabase to send, if supported) a "your password was changed" email as a security signal — if the user didn't do it, they know to act immediately. This is a strong, low-cost security UX win.
- **Password strength requirements**: align with whatever Supabase's project-level policy is configured to (or set one) — minimum length, and ideally a simple strength meter in the UI rather than just a rule list.

---

## 3. Reset Password for Logged-In Users (Ticket #4)

### Recommended approach: build directly on top of #3's primitives
This is the simpler of the two, since the user is already authenticated:
1. Add a **"Change password"** action in `ProfilePage` (a natural neighbor to the existing "Update", "Sign out", and account-deletion actions).
2. Flow: current password → new password → confirm new password. Re-prompting for the current password (a "re-auth" step — Supabase supports re-authentication via `reauthenticate()` or by re-validating credentials) prevents a scenario where someone with a hijacked, still-logged-in session changes the password to lock the real owner out.
3. On success: `supabase.auth.updateUser({ password })`, show a success toast, and — as with the forgot-password flow — send a "your password was changed" notification email and consider invalidating other sessions.

### Guardrails
- Same rate limiting philosophy: cap how often a password can be changed in a short window (e.g. no more than 3 changes per hour) to blunt automated abuse of a compromised session.
- Reuse the same password-strength validation component as the forgot-password screen — don't maintain two copies of the same rules.

---

## 4. Session Management (Ticket #8)

### Current state
Supabase's SDK handles session persistence and token refresh automatically (`AuthContext.tsx:54-66`); there's no "last activity" tracking and no inactivity-based logout.

### What's worth adding, roughly in order of value-to-effort

1. **"Last active" timestamp** — a lightweight `profiles.last_active_at` column updated on a throttled basis (e.g. once per N minutes of app use, not on every click) gives you the foundation for several other tickets too: re-engagement emails (#20), "inactive user" detection, and potentially buddy-page status indicators ("active 2 days ago"). Cheap to add, useful in many places — a good first move.
2. **Idle/inactivity timeout (optional, and worth weighing carefully)**: health/fitness apps generally do *not* aggressively log users out on inactivity the way banking apps do — it tends to hurt engagement more than it helps security, since the data isn't typically as sensitive as financial data. If you want *something* here, a soft pattern is better: after a long idle period (e.g. 30 days of no app opens on a device), require re-authentication on next open, rather than killing active sessions mid-use. Recommend treating this as low priority unless there's a specific compliance driver.
3. **"Active sessions" visibility & revocation** — a Profile-page section listing active sessions/devices with a "sign out everywhere" action. Supabase supports global sign-out (`signOut({ scope: 'global' })`). This pairs naturally with the password-change flows above (auto-trigger "sign out everywhere" after a password change) and is a feature users increasingly expect from any account-holding app.
4. **Session-expiry UX**: ensure that when a refresh token finally does expire (long-idle devices), the user is routed to login with a friendly "Your session expired, please log in again" message rather than a confusing blank/broken state — verify this is already graceful via the `onAuthStateChange` subscription, and patch if not.

### Suggested sequencing
Do (1) first — it's low-risk and unlocks value elsewhere. Treat (2) as optional/low-priority pending a real signal that it's needed. Do (3) alongside the password-change work in #3/#4, since they're naturally complementary (and "sign out everywhere" becomes a one-line addition once the underlying capability exists). Do (4) as a quick audit/patch rather than a feature build.
