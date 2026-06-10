# Plan: Error Logging/Monitoring & Email System

Covers tickets **#7 (error logging mechanism), #20 (transactional & lifecycle emails)**.

Grouped together because both are "platform plumbing" that many other tickets in this batch depend on — e.g. doc 02's security emails, doc 03's reminder emails, doc 04's referral notifications, and doc 05's plan-adjustment audit trail all assume *some* logging and email capability exists. Recommend prioritizing these relatively early, even though they're less visible than feature work.

---

## 1. Error Logging & Monitoring (Ticket #7)

### Current state
A basic React `ErrorBoundary` catches render errors and logs to console; individual pages have local try/catch with inline error UI. There is no centralized collection, no visibility into errors happening in production, and no backend/edge-function error tracking.

### Research: industry-standard approaches for a stack like this
For a React + Supabase (Postgres + Edge Functions/Deno) app, the standard, well-trodden options are:

| Tool | Fit | Notes |
|---|---|---|
| **Sentry** | Excellent — has first-class React SDK (auto-wraps error boundaries, captures unhandled promise rejections, breadcrumbs) and Deno/edge support for the Supabase functions side | Free tier is generous for early-stage projects (error volume limits, not feature limits); becomes the de facto industry standard for exactly this kind of stack |
| **LogRocket** | Strong if session-replay (seeing exactly what the user did before an error) becomes valuable | Generally pricier than Sentry at scale; replay-focused rather than error-focused |
| **Highlight.io / OpenReplay** | Open-source alternatives with session replay + error tracking | Smaller ecosystems, more setup effort, but avoids vendor lock-in and can be self-hosted for $0 infra cost beyond hosting |
| **Custom Postgres-backed logging** | Zero new vendor, fits "free" requirement perfectly | No alerting, dashboards, or stack-trace tooling out of the box — you'd be rebuilding a worse version of the above over time |

### Recommendation: Sentry (free tier) as the primary tool, backed by a lightweight custom table for app-specific context
Sentry's free tier comfortably covers an early-stage app's error volume and gives you stack traces, alerting, release tracking, and a real dashboard — all the things a hand-rolled solution would take significant effort to approximate. Pair it with a thin custom `error_logs` table (or just rely on Sentry's user-context tagging) only if you specifically need to correlate errors with FitPath-specific data (e.g. "which plan-generation prompts are failing") in ways Sentry's generic tooling doesn't capture well.

### What to instrument, in priority order
1. **Edge functions** (especially `generate-plan` — it already has explicit error paths around AI timeouts/validation failures that are currently only visible via Supabase's function logs). Wrap the Gemini call and Zod validation in Sentry's Deno SDK so failures surface centrally rather than requiring a manual log dive.
2. **Global unhandled errors & promise rejections** in the React app (Sentry's React SDK does this with minimal setup — typically a few lines in the app entry point).
3. **The existing `ErrorBoundary`** — wire it to report caught errors to Sentry in addition to (or instead of) console logging, while keeping its user-facing fallback UI.
4. **Critical user-flow failures** — auth errors, plan-generation failures, payment-adjacent flows (if any are added later) — tag these specifically so they can be filtered/alerted on distinctly from routine noise.

### User-facing side of "logging for further analysis" (the ticket's phrasing suggests this matters to the user too, not just the team)
- Keep error messages **honest but calm** — "Something went wrong on our end — we've been notified and are looking into it" beats a raw stack trace or a generic "Error 500."
- Consider a lightweight **"Report a problem"** affordance on error states (ties into the Contact Us page from doc 01) that attaches the relevant error context automatically — turning a frustrating moment into a frictionless feedback loop, and giving the team richer signal than passive logging alone.

### Sequencing
This is foundational — recommend doing it *before or alongside* several other tickets (vitals validation, plan adjustments, referral tracking) so that as those ship, their failure modes are visible from day one rather than discovered via user complaints.

---

## 2. Email System (Ticket #20)

### Current state
Only Supabase Auth's built-in transactional emails exist (signup verification, resend). No custom sending capability, no templates, no scheduled/triggered lifecycle emails — though the groundwork for several is already sitting unused (`tracking_config.reminder_morning/evening`).

### Research: free/low-cost email infrastructure that fits a Supabase + edge-functions stack
| Service | Free tier (approximate, verify current terms before committing) | Fit |
|---|---|---|
| **Resend** | Generous free tier; built specifically with developer ergonomics and React-based templates (`react-email`) in mind | Probably the best fit — modern API, great docs, integrates cleanly with Deno edge functions via simple HTTP calls, and its template system (JSX-based) matches the existing React-centric codebase conventions |
| **SendGrid** | Free tier exists but historically smaller and the platform feels heavier/more enterprise-oriented | Workable, but more setup ceremony for less ergonomic payoff than Resend for a project this size |
| **Postmark** | Excellent deliverability reputation, free trial but not a permanent free tier | Worth it later if deliverability becomes a measurable problem; not the free starting point |
| **Supabase Auth's built-in sender** | Already free and working for verification emails | Limited to Supabase Auth's own templated flows (verification, password recovery) — not usable for custom lifecycle emails like weekly summaries |

**Recommendation: Resend**, called from edge functions, with `react-email` for templates — this keeps the entire stack in the same language/ecosystem (TypeScript/React) the team already works in, which lowers the maintenance burden significantly.

### The email types requested, mapped to triggers and rough build order

1. **Welcome email** *(easy, high value — do first)*
   - Trigger: on first successful login post-verification (or immediately on verification, depending on the data-creation-timing decision in doc 02).
   - Content: warm welcome, what to expect, a nudge toward finishing onboarding if not yet done.

2. **Plan details as a document** *(moderate effort, clear value)*
   - Trigger: on successful plan generation.
   - Content: a clean, readable summary/export of the generated plan — likely simplest as a well-formatted HTML email (rendered from the same `plan_data` structure already used by `PlanPage`) rather than a generated PDF/attachment, which adds real complexity (PDF generation in Deno edge functions is non-trivial) for marginal benefit. An HTML email *is* the document for v1; a downloadable PDF can be a future enhancement if users specifically ask for one.

3. **Weekly summary** *(moderate effort, needs a scheduler)*
   - Trigger: a scheduled job (Supabase cron / `pg_cron`, or an external scheduler hitting an edge function weekly) that aggregates the past week's `task_logs`/`streaks`/`body_measurements` per user.
   - Content: tasks completed vs. missed, streak status, any milestones hit, a gentle look-ahead to the coming week. This is also a natural home for surfacing the Consistency Score from doc 04/05's reward system once it exists.
   - Note: this is the first email type that requires genuine **scheduling infrastructure** — flag it as the point where the email system needs an operational job runner, not just request-triggered sends.

4. **Inactive users with a generated plan** *(re-engagement — needs the "last active" tracking from doc 02)*
   - Trigger: scheduled job checking `profiles.last_active_at` (proposed in doc 02) against a threshold (e.g. 7-10 days of inactivity) for users who *do* have an active plan.
   - Content: empathetic, not guilt-driven — "Your plan is still here whenever you're ready" beats "You haven't logged in for a week!" — paired with one easy re-entry action (e.g. a direct link back to today's checklist).
   - Cadence guardrails: cap how often a given user receives this (e.g. once per inactivity episode, not daily) to avoid becoming the exact kind of noise that drives unsubscribes.

5. **Daily bytes** *(depends on doc 05's content library existing first)*
   - Trigger: scheduled daily send of a matched "byte" from the content library.
   - This is naturally **sequenced after** ticket #18 — there's nothing to send until the content and matching system exist. Treat it as a "distribution channel" for that feature rather than a standalone build.

6. **"Free emails research"** *(the ticket's own framing — interpreted as: keep this entirely within free-tier limits)*
   - All of the above are achievable within Resend's (or a similar provider's) free tier at early-stage volume — the main cost driver to watch is *send volume × frequency*, which is exactly why each type above has a defined trigger and cadence cap rather than being unbounded. Revisit provider choice only if/when volume genuinely outgrows the free tier — a good problem to have, and a switch that `react-email`-based templates would make relatively painless since the templates themselves aren't provider-specific.

### Cross-cutting requirements for any of these
- **Unsubscribe/preferences**: even transactional-leaning emails like weekly summaries and daily bytes should have a simple preferences mechanism (a `notification_preferences` table or jsonb column on `profiles`) — both because users expect it and because most jurisdictions' anti-spam rules (CAN-SPAM, CASL, GDPR's e-privacy rules) require it for non-essential mail. Pure account-security emails (verification, password-change notices from doc 02) are generally exempt from this requirement, but everything else should respect it.
- **Template consistency**: build one shared base template (branding, footer with the legal links from doc 01, unsubscribe link) and compose individual email types on top of it — avoids visual drift and repeated boilerplate.
- **Delivery monitoring**: feed send failures into the error-logging system from part 1 of this doc — an email silently failing to send is exactly the kind of thing that should be visible, not discovered when a user says "I never got my weekly summary."

### Suggested build order
Welcome → Plan-details → (build scheduling infra) → Weekly summary → Inactive-user re-engagement → Daily bytes (after doc 05's content exists). This order front-loads the simplest, most immediately valuable sends, defers the ones with real infrastructure dependencies (scheduling, content library) until those dependencies are in place, and naturally builds the shared template/preferences plumbing incrementally rather than all at once.
