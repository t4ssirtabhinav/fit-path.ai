# Beta Readiness Priority Matrix

A **plan-only prioritization pass** over the 20 tickets covered by docs [01](01-pre-login-trust-and-legal.md)-[06](06-platform-error-logging-and-emails.md) (the "first" roadmap — `docs/planning/`, *not* `docs/planning/next-release/`), plus **7 new items** raised separately (N1-N7 below). Nothing here is built. The goal is a single reference table to start sequencing tickets toward a **polished beta** — i.e. an experience real users can run through end-to-end (signup → onboarding → daily use → progress) without hitting broken paths, generic/low-value content, or silent data loss.

This matrix also folds in three **Critical** items from [03-system-audit-2026-06.md](03-system-audit-2026-06.md) (§9 #1-3) as Tier 0 bug-fixes, because they directly affect the "polished" bar (a visibly-broken streak counter or a generic "not medical advice" gap undermines the same trust this matrix is trying to build).

---

## 1. New items (N1-N7) — framing

These weren't part of the original 20-ticket roadmap. Brief framing for each before they go into the matrix:

### N1 — Flatten & de-genericize the AI-generated workout plan
**Problem**: per the request, generated workout plans are currently "not flattened and very small/vague/generic" — likely too high-level (e.g. "Upper body workout — 30 min" rather than per-exercise sets/reps/weight/progression).
**Why it matters now**: this is the headline value proposition ("a plan built around your life, not a generic template" — see doc 01's own landing-page copy). A vague plan undercuts that promise *and* blocks N2 below — you can't log "3 sets of 8 reps @ 40kg for Bench Press" against a plan that just says "Upper body workout."
**Direction**: prompt-engineering + `planSchema.ts` schema work in `generate-plan` to require per-exercise structure (name, sets, reps, weight/intensity guidance, rest, progression notes) for every workout day — "flatten" likely means ensuring this structure is consistent across *all* days/phases, not just a sample day. Should be scoped together with N2 since the schema needs to support what the logger will read/write.

### N2 — Workout/exercise logger (sets × reps × weight, PRs, custom exercises)
**Problem**: today's "Today page" only tracks task *completion* (done/not done) — there's no mechanism to log the actual performance (weight lifted, reps done, sets completed) or track personal records (PRs).
**Why it matters now**: this is arguably the single highest-impact item in this whole list — "tracking your workouts" is the core promise of a fitness app, and a checkbox-only experience feels like a to-do list, not a fitness tracker.
**Direction** (phased):
- **Phase 1**: for each plan exercise (depends on N1's structured data), let the user log actual sets — each set is `{reps, weight}` — with `+`/`-` controls to add/remove sets, defaulting to the plan's prescribed sets/reps as a starting point the user adjusts.
- **Phase 2**: PR detection — when a logged set's weight (at a given rep range) exceeds the user's historical best for that exercise, flag it ("New PR! 🎉") and persist a `personal_records` table (or derive PRs on read from the logs — cheaper to start, revisit if it gets slow).
- **Phase 3**: "add an exercise not in your plan" — a searchable/freeform exercise picker that logs against an ad-hoc entry, same data shape as plan exercises.
- **Phase 4 (apply the same pattern elsewhere)**: the prompt explicitly asks for "similar... for other modalities where this feels required for a consistent UX" — e.g. yoga (poses/duration/hold-time), cardio (distance/duration/pace), home workouts (same as gym). Don't build N modality-specific loggers — design **one generic "logged set/segment" data shape** (it's already close to `{reps, weight}` vs `{duration, distance}` vs `{duration, hold}` — a small discriminated-union or flexible jsonb column per category) so adding a new modality's logging is a config change, not a new feature, mirroring the Phase 2 modality-registry pattern already used for plan generation.

New table(s) needed: something like `exercise_logs` (`user_id, task_date, exercise_name, category, sets jsonb, source: 'plan'|'custom', created_at`) — append-only per the audit's "vitals can't be updated" precedent (doc 03 §3, ticket #10) seems *not* appropriate here (workout logs should be editable same-day, since users often adjust mid-workout) — but the exact mutability rule is a design decision for the implementation ticket, not this matrix.

### N3 — Meal logger (details now, AI macro/nutrition extraction later)
**Problem**: meals appear in the generated plan but there's no way to log what was actually eaten.
**Direction** (phased):
- **Phase 1 (Should-have for beta)**: manual meal logging — user logs what they ate (free text or simple structured fields: meal name, portion description, optional calories/macros if they know them), tied to the plan's meal slots (breakfast/lunch/dinner/snacks) similar to how N2 ties to plan exercises.
- **Phase 2 (defer — AI cost & complexity)**: AI-powered nutrition/macro extraction from a text description (or photo, if ever pursued) — this is a *new, ongoing per-use AI cost* (every meal log = an LLM call), directly relevant to the cost concerns already raised in doc 03 §5 (no usage logging/cost tracking exists yet — that should land *before* a feature that multiplies AI call volume by "every meal, every user, every day"). Treat as Tier 3/post-beta, and sequence after doc 03's §5.3 (`ai_usage_log` + per-user caps) regardless of how eager this feels.

### N4 — "Tracking only" path is not functional — full tracking suite
**Problem**: per the request, the tracking-only onboarding path ("I want to track, not get a generated plan") doesn't currently provide a working experience.
**Relationship to existing tickets**: this is **the same problem space as ticket #11** (only-tracking feature parity) and overlaps with #10 (Today-page logging revamp) — doc 03 (the original roadmap doc, not this audit) already designed #10's logging surface to be *driven by `tracking_config`* for tracking-only users. The difference is urgency: #11 was framed as a "parity/enhancement" ticket; if the path is outright broken today, this is a **bug-fix-severity item**, not a polish item — a user who picks "track only" during onboarding and lands on a broken/empty experience is a beta-ending first impression.
**Direction**: treat N4 as "ticket #11, re-prioritized to Tier 0/1" — first establish *what specifically* is broken (likely: dashboard checklist is seeded from `plans` and tracking-only users have no `plans` row, so they see nothing), then build the `tracking_config`-driven checklist doc 03 already specified. N2/N3's logging infrastructure should be designed with tracking-only users in mind from the start (a tracking-only user logging "ran 5km" should use the same `exercise_logs` shape as a plan-path user).

### N5 — Edit Profile page cleanup: no erroneous/extra updates
**Problem**: profile editing should only write fields that actually changed, avoid unnecessary/incorrect updates, and stay "in sync with other technicalities and functionalities related to updates" (i.e. changes here shouldn't desync `AuthContext`'s cached profile, `health_profiles`, `tracking_config`, etc.).
**Direction**: an audit-style pass on `ProfilePage`'s update handler(s) — likely a diff-based update (only send changed fields to `ProfileRepository.update`/`HealthProfileRepository.update`), confirm `AuthContext.refreshProfile()` is called after any write that affects cached profile fields (timezone, display name, avatar), and confirm related tables (`tracking_config`, `health_profiles`) aren't redundantly rewritten when only `profiles` fields changed. This is a contained, mostly-mechanical cleanup — good candidate for a quick early win, and a natural place to also land N6.

### N6 — Mobile number on profile (verification deferred)
**Problem**: add a `phone_number` field to the profile, collected/editable but **not verified yet** ("verification for later on").
**Direction**: small migration (`profiles.phone_number text`, nullable), add to `ProfilePage`'s edit form (and optionally as an optional onboarding field), basic format validation only (no OTP/verification flow now — that's a separate, larger ticket). This is intentionally small *because* it's the prerequisite for N7 — sequencing it early de-risks N7 without committing to N7's full scope yet.

### N7 — WhatsApp integration (reminders, daily plan, check-in) — long scope
**Problem/ask**: let users receive reminders and their daily plan via WhatsApp, and optionally log progress *from* WhatsApp (check-ins) — explicitly framed as "long scope, map end-to-end journey."
**Why this is Tier 3, but worth scoping now**:
- **New external dependency + ongoing cost**: WhatsApp Business Platform (via Meta Cloud API or a BSP like Twilio/360dialog/Gupshup) charges per conversation/message after free tiers, requires business verification (can take weeks), and has strict opt-in/template-approval rules for outbound messages — this is categorically different from the in-app/email work elsewhere in this matrix.
- **Depends on N6** (need a verified phone number — "verification for later" in N6 becomes a hard requirement for N7, since WhatsApp messaging requires a real, opted-in number) and on **#8/#20** (reminder times and notification-preference infrastructure should exist in *one* place that WhatsApp becomes an additional channel for, not a parallel system).
- **Two-way (check-in via WhatsApp)** is the genuinely hard part — it means parsing free-form WhatsApp replies into structured logs (ties back to N2/N3's data shapes) and handling ambiguity/errors in chat, which is a different UX discipline than in-app forms.
**Direction now**: produce a short **end-to-end journey map** (as a planning doc, no build) covering: opt-in flow (where/when a user enables WhatsApp, consent language per doc 01's compliance work since this is another "data goes to a third party" disclosure), one-way notifications first (daily plan summary, reminders — reusing #20's content), and two-way check-ins as an explicit *phase 2* with its own risk/complexity callout. Do not build the integration itself for beta.

---

## 2. Scoring legend

| Axis | Scale |
|---|---|
| **Beta necessity** | 🔴 **Must** — broken/missing this undermines the core beta experience or is a trust/legal blocker · 🟠 **Should** — meaningful quality gap, do soon after Must items · 🟡 **Nice** — polish/engagement, fine to follow beta · ⚪ **Post-beta** — defer, revisit after beta signal |
| **Effort** | S (days) · M (1-2 weeks) · L (3-4 weeks) · XL (multi-phase / >4 weeks) |
| **Complexity** | Low (well-trodden, existing patterns) · Med (new schema/data model or moderate new logic) · High (new external service, AI-prompt iteration, or cross-cutting data model change) |
| **Cost** | None · Low (within existing free tiers) · Medium (modest ongoing $, e.g. extra AI tokens, storage) · High (new paid service / per-message costs) |
| **Impact** | Low · Medium · High · Very High — effect on conversion, daily-use quality, retention, or trust |

---

## 3. Master priority matrix

### Tier 0 — Foundational / do first (small, high-leverage, often unblocks others)

| ID | Item | Beta necessity | Effort | Complexity | Cost | Impact | Dependencies / notes |
|---|---|---|---|---|---|---|---|
| Audit-1 | Fix streak "yesterday" timezone bug | 🔴 Must | S | Low | None | High | [03-system-audit §3.1](03-system-audit-2026-06.md#31-critical-streak-date-math-doesnt-consistently-use-the-users-timezone) — visible, demoralizing bug |
| Audit-2 | Fix `ProgressPage` "is today" timezone bug | 🔴 Must | S | Low | None | Medium | [03-system-audit §3.2](03-system-audit-2026-06.md#32-critical-progresspage-is-today-check-ignores-profile-timezone) |
| Audit-3 | Add medical-safety guardrails to plan prompt | 🔴 Must | S-M | Low-Med | None | Very High | [03-system-audit §5.1](03-system-audit-2026-06.md#51-critical-no-medical-safety-guardrails-in-the-plan-generation-prompt) — trust/liability |
| #7 | Error logging & monitoring (Sentry) | 🔴 Must | S-M | Low | None (free tier) | High | Foundational — surfaces every other bug fixed in this matrix |
| #3 | Forgot password | 🔴 Must | S-M | Low | None | High | Standard auth completeness; Supabase-native flow |
| N6 | Mobile number field on profile (no verification yet) | 🟠 Should | S | Low | None | Low (now) / enables N7 | Prereq for N7 |
| N5 | Profile edit cleanup (diff-based updates, sync) | 🟠 Should | S-M | Low | None | Medium | Contained; pairs naturally with N6 |

### Tier 1 — Core beta polish (the bulk of the work; sequence within tier matters)

| ID | Item | Beta necessity | Effort | Complexity | Cost | Impact | Dependencies / notes |
|---|---|---|---|---|---|---|---|
| N4 | Fix "tracking only" broken experience (= ticket #11, re-prioritized) | 🔴 Must | L | Med | None | Very High | First diagnose root cause; reuses #10's design |
| N1 | Flatten/de-genericize workout plan generation | 🔴 Must | M | Med-High | Low (token usage) | Very High | Blocks N2; AI prompt + schema iteration |
| N2 | Workout/exercise logger (Phase 1: sets/reps/weight) | 🔴 Must | L-XL | Med-High | None | Very High | Depends on N1; phase the rest (PRs, custom exercises, other modalities) |
| #10 | Today-page logging revamp (structured vitals) | 🟠 Should | L | Med-High | None | High | Same epic as N2/N4 — plan together, don't build 3x logging UIs |
| N3 (Phase 1) | Meal logger — manual logging | 🟠 Should | M | Med | None | High | Depends on N1 (structured `daily_meals`); AI phase deferred (Tier 3) |
| #9 | Post-signup soft-gate UX / empty states | 🟠 Should | M | Low-Med | None | High | Reduces onboarding drop-off; pairs with N4 (tracking-only empty states) |
| #5 | Compliance/privacy/legal research | 🔴 Must | M | Low | Medium ($ for legal review/policy tool) | High (risk mitigation) | Should start early — long lead time (legal review) |
| #6 | Footer & legal pages (Privacy/Terms/About/Contact) | 🟠 Should | S (after #5) | Low | None | Medium | Blocked on #5's content |
| #2 | Email verification gap-closing (defer profile creation, rate limits) | 🟠 Should | S-M | Med (auth trigger change) | None | Medium | Security/storage hygiene; handle carefully (auth trigger) |
| #4 | Reset password (logged-in users) | 🟠 Should | S | Low | None | Medium | Builds directly on #3's primitives |
| #8a | "Last active" timestamp | 🟠 Should | S | Low | None | Medium | Cheap; unlocks #20 re-engagement + N7 later |
| #20a | Welcome + plan-details emails | 🟠 Should | M | Low-Med | Low (Resend free tier) | Medium | Two easiest, highest-value email types; sets up template/infra for later |
| #13 | Profile image upload | 🟡 Nice | M | Low | Low (storage) | Medium | Contained, well-trodden (Supabase Storage); good "easy win" filler |

### Tier 2 — Strong follow-ups (post-initial-beta, high value)

| ID | Item | Beta necessity | Effort | Complexity | Cost | Impact | Dependencies / notes |
|---|---|---|---|---|---|---|---|
| #12 | Reporting/dashboarding/scoring | 🟡 Nice | L | Med | None | High | Downstream of #10/N2/N3 — needs structured data first |
| #17 | Self-service plan adjustments + AI validation | 🟡 Nice | XL | High | Medium (extra AI calls) | High | Reduces frustration vs. full regen; large new surface |
| #1 | Landing/carousel pre-login experience | 🟡 Nice | M | Low-Med | None | Medium-High | Matters more once beta is public-facing vs. invite-only |
| #15 | Loyalty & rewards (Consistency Score) | 🟡 Nice | M-L | Med | None | Medium | Depends on #12's data; pairs with N2/N4 (real activity to score) |
| #18a | "Tip of the Day" (lightweight content) | 🟡 Nice | S-M | Low | None | Low-Medium | Cheap engagement filler; full content library is Tier 3 |
| #20b | Weekly summary + re-engagement emails | 🟡 Nice | M | Med (needs scheduler) | Low | Medium | Needs `pg_cron`/scheduling infra; depends on #8a |
| #8b | Active sessions list + "sign out everywhere" | 🟡 Nice | S-M | Low | None | Low-Medium | Pairs naturally with #2/#4 password-change flows |
| Audit-cluster | Remaining audit §9 High items (N+1 fix, error-handling consistency, CORS, etc.) | 🟠 Should (rolling) | Mixed (mostly S-M each) | Low-Med | None | Medium-High | Roll into sprints alongside whichever feature touches that file |

### Tier 3 — Post-beta / growth / long-horizon

| ID | Item | Beta necessity | Effort | Complexity | Cost | Impact | Dependencies / notes |
|---|---|---|---|---|---|---|---|
| #14 | Buddy groups/leaderboards | ⚪ Post-beta | L | Med | None | Medium | Buddy 1:1 already works; this is an enhancement |
| #16 | Referral system | ⚪ Post-beta | M | Low-Med | None | Medium (growth) | Wants #15's reward system to exist first |
| N3 (Phase 2) | AI meal/macro extraction | ⚪ Post-beta | XL | High | High (per-log AI cost) | High (if it lands well) | Sequence after [03-system-audit §5.3](03-system-audit-2026-06.md#53-high-no-usagecost-logging-or-per-user-quota--financial-exposure) (`ai_usage_log`) |
| N7 | WhatsApp integration — journey map only | ⚪ Post-beta (map now) | XL (build) / S (journey doc) | High | High (per-message $, business verification) | High (if it lands, esp. India market) | Depends on N6 + #8/#20 notification infra |
| #18b | Full tagged content library | ⚪ Post-beta | L | Med | Low (content ops, not eng) | Medium | "Tip of the Day" (Tier 2) validates demand first |
| #19 | Plan-gen fallback / weighted matching | ⚪ Post-beta (already deferred) | XL | High | Medium | Medium | Already explicitly deferred to "Phase 5" — no change |

---

## 4. Sequencing notes

1. **Tier 0 is mostly bug fixes and cheap setup** — none of it is glamorous, but Audit-1/2/3 are the kind of thing a beta tester finds in their first week ("my streak reset for no reason," "is this safe for my back injury?"). Sentry (#7) should land before the bigger Tier 1 work starts, so its failure modes are visible from day one — this mirrors doc 06's own sequencing advice.

2. **N1 → N2 → N4/#10 form one connected epic** ("the daily logging core"), and should be planned as a single mini-roadmap rather than four separate tickets, the same way doc 03's original cluster (#9-13) was framed. Order: N1 (plan structure) unblocks N2 (workout logging) and N3-phase1 (meal logging); N4 (tracking-only fix) and #10 (vitals revamp) should reuse the *same* logging UI/data patterns N2 establishes — building three different "log your X" surfaces would be the kind of premature-divergence the codebase has otherwise avoided (cf. the modality-registry pattern from Phase 2 of the architecture migration).

3. **#5 (compliance research) has a long external lead time** (lawyer/policy-tool review) — start it early even though the *output* (legal pages, #6) isn't urgent until closer to a public beta, so the lead time doesn't block launch later.

4. **N7 (WhatsApp) is intentionally the only item where "map the journey" and "build it" are explicitly split** — everything else in Tier 3 can wait wholesale, but N7's dependency on N6 means even *deciding* to pursue N7 later should inform whether N6 collects/stores the phone number in a WhatsApp-compatible format (E.164) now, to avoid a data-migration later.

5. **This matrix deliberately does not re-litigate `docs/planning/next-release/`** (mobile/wearables, India legal/funding, menstrual cycle tracking, offline/admin, competitive landscape) — those are a separate, later horizon per their own README, and several (mobile apps, India business/legal) are natural *next* steps after this matrix's Tier 1/2 ship, but are out of scope for this pass per the request.

---

## Critical files referenced

- `supabase/functions/generate-plan/index.ts`, `src/lib/planSchema.ts` (N1, N3, Audit-3)
- `src/pages/DashboardPage.tsx`, `src/pages/ProgressPage.tsx`, `src/services/StreakService.ts` (Audit-1, Audit-2, N2, N4, #10)
- `src/pages/ProfilePage.tsx`, `src/contexts/AuthContext.tsx` (N5, N6, #13)
- `src/pages/OnboardingPage.tsx`, `tracking_config` table (N4, #9, #11)
- `docs/architecture/03-system-audit-2026-06.md` (Audit-1/2/3 and the rolling Tier 2 audit cluster)
- `docs/planning/03-tracking-vitals-dashboards-profile.md` (#9-13, design basis for N2/N3/N4/#10)
- `docs/planning/06-platform-error-logging-and-emails.md` (#7, #20)
