# Plan: Offline-First Logging, Image Uploads, Encryption, Admin Dashboard, Dark Mode & Product Analytics

Covers tickets **#7 (offline-first logging), #9 (image uploads/progress photos), #11 (health data encryption), #12 (admin dashboard), #15 (dark/light mode), #16 (user/journey metrics)**.

A grab-bag of platform-engineering tickets that share one trait: each is a "foundation" investment that makes everything else (mobile app, wearables, engagement features) work better — none is a user-facing headline feature on its own.

---

## 1. Offline-First Logging (Ticket #7)

### What the ticket is really asking
"Reduce DB reads" plus offline-first logging are two related but distinct goals: **offline-first** means the app stays usable without connectivity (writes queue locally, sync later); **fewer DB reads** is a caching/architecture concern that benefits from the same local-first infrastructure but can also be tackled independently (e.g. better query caching with TanStack Query, which the app may already use).

### Sync-engine options for a Supabase + React/RN stack
| Tool | Fit | Notes |
|---|---|---|
| **WatermelonDB** | Mature, React Native-first, battle-tested (used by GitHub's mobile app, Brilliant) | Requires a custom sync adapter to talk to Supabase/Postgres — more setup work, but well-documented patterns exist |
| **PowerSync** | **Purpose-built for Postgres/Supabase** — markets itself explicitly as "the Supabase offline-sync layer" | Probably the lowest-friction option given the existing stack; managed service has a cost beyond a free tier, self-hosting is possible |
| **Legend-State** | Lighter-weight, newer, growing React/RN community traction | Smaller ecosystem/community than WatermelonDB; good if the offline surface area is modest |

**Recommendation**: **PowerSync** is the most natural fit precisely *because* it's designed around Postgres/Supabase — it minimizes the "two databases that need to agree" problem that's the core difficulty of any offline-first system. Evaluate its pricing against the expected user base before committing; for a smaller user base, the free/self-hosted tier is likely sufficient to prototype.

### What should actually go offline-first first
Not everything needs offline support — prioritize by where connectivity loss actually hurts:
1. **Task completion logging** (checking off plan items) — the highest-frequency write, and the most painful to lose if connectivity drops mid-workout/mid-meal.
2. **Vitals/measurement entry** — second priority; these are time-sensitive and users may be in low-connectivity environments (gyms, early morning).
3. Read-heavy views (today's plan, progress charts) benefit more from **caching** than true offline-write support — a well-tuned TanStack Query cache with a reasonable `staleTime` addresses "reduce DB reads" for these without the full complexity of a sync engine.

### Architecture implications
- Local writes need a **conflict-resolution strategy** — for append-only logs (task completions, vitals entries) "last write wins" is usually safe since these are rarely edited after creation (and vitals are already immutable per the prior roadmap's design). This significantly simplifies the sync story versus a general-purpose offline CRUD system.
- Plan to surface **sync status** to the user ("3 items waiting to sync" / a subtle offline indicator) — silent failure erodes trust fast.
- This is **substantially easier to justify once the native app exists** (doc 02) — offline use cases are far more common on mobile (gym basements, commutes, travel) than on a desktop web app. Recommend sequencing this *with or just after* the mobile beta, not before.

---

## 2. Image Uploads / Progress Photos (Ticket #9)

### The straightforward part
Supabase Storage already supports this pattern well — the existing **profile image** ticket (#10 from the prior roadmap, planned in `docs/planning/03-tracking-vitals-dashboards-profile.md`) establishes the bucket/upload/RLS pattern; progress photos are the same mechanism applied to a new context (a `progress_photos` table referencing storage paths, linked to a user and a date).

### What makes progress photos different from a profile picture (and more sensitive)
- **They're a far more sensitive data category** — body photos over time are arguably more personal than most vitals data. This needs **private-by-default storage** (signed URLs, not public buckets), explicit consent language distinct from the general privacy policy, and a clear, easy **deletion path** (both "delete one photo" and "delete all my photos").
- **Comparison/timeline UX** is the actual value driver — a single photo isn't very useful; a side-by-side "then vs. now" or a timeline slider is what makes this feature meaningful (this is the headline feature of apps like Progress and AmIFitter, which exist *solely* for this).
- **Storage cost compounds**: photos are large relative to typical app data — plan for image compression/resizing on upload (client-side before upload, or a Supabase Edge Function/transform), and consider a per-user storage cap communicated transparently.

### Recommended scope for v1
- One photo per logged day maximum (ties naturally to the existing daily-logging cadence), tagged with a category (e.g. front/side/back) for consistent comparison.
- A simple before/after slider or side-by-side view on the Progress page.
- Private storage + signed URLs + an explicit "Delete all my photos" action surfaced in privacy settings.

---

## 3. Health Data Encryption (Ticket #11)

### The honest research finding: column-level encryption is usually the wrong move
Supabase's own guidance is direct: **`pgcrypto`-based column-level encryption is *not* recommended** for most use cases due to real operational costs — key management complexity, broken `WHERE`-clause filtering and indexing on encrypted columns, and migration pain. Their stated position is that **encryption-at-rest (which Supabase provides by default at the infrastructure level) is sufficient for the large majority of compliance needs**, and that application-level encryption should be reserved for a narrow class of fields with genuinely extreme sensitivity. ([Supabase: Vault docs / column encryption guidance](https://supabase.com/docs/guides/database/vault))

### What this means for FitPath
- **Don't encrypt vitals/measurements/plans at the column level** — infrastructure-level encryption-at-rest (already provided) plus the **RLS policies already in place** (per the codebase audit) are the right combination for this kind of data, and preserve query performance and indexing.
- **Reserve any application-level encryption for a genuinely narrow category** — if anything, this would be things like raw third-party API tokens (Fitbit/Garmin OAuth tokens, once wearable integration exists) — exactly the kind of secret that benefits from **Supabase Vault** (their managed `pgsodium`-backed secrets store), not ad-hoc `pgcrypto`.
- **The actual compliance lever is access control and auditability**, not encryption theater: make sure RLS policies are airtight (this is where `get_advisors` via the Supabase MCP tools should be run periodically), access to the database is logged, and the data-handling principles from the prior roadmap's compliance doc (`docs/planning/01-pre-login-trust-and-legal.md`) are followed in practice.

### Recommended action
Treat ticket #11 as **mostly already satisfied** by Supabase's infrastructure defaults plus solid RLS — the actionable work is an **RLS audit** (run `get_advisors` and manually review policies on `body_measurements`, `task_logs`, `plans`, and any future `progress_photos`/wearable-token tables) rather than a column-encryption project. This reframing saves significant engineering effort that would otherwise go toward a change that Supabase's own team advises against.

---

## 4. Admin Dashboard (Ticket #12)

### Core design principle: privacy-by-design from day one (the ticket's own qualifier)
The ticket explicitly says "comprehensive... and privacy compliant" — this should shape the dashboard's *architecture*, not just its feature list:
- **Default to aggregates, not individual records.** An admin should see "47 active users this week, 12% week-over-week growth, 3 flagged content reports" before — and ideally instead of — being able to browse individual users' health data.
- **Any drill-down into individual user data needs a justified-access pattern**: a reason-for-access field, an audit log of who viewed what and when, and ideally time-limited access grants. This is standard practice in health-adjacent products and is exactly the kind of control that turns "privacy compliant" from a claim into a demonstrable practice.
- **Role-based access** — not every team member (today: probably just the founder, but this should be designed to scale) needs the same dashboard surface.

### Suggested feature set, roughly in priority order
1. **Operational health**: active users (DAU/WAU/MAU), signups over time, plan-generation success/failure rates, error rates (ties directly to the Sentry integration planned in the prior roadmap's doc 06).
2. **Content/safety moderation**: flagged buddy messages or profile content (if/when the buddy feature grows — ties to the prior roadmap's doc 04), reported issues.
3. **Support tooling**: search for a user (by email/ID, with the access-justification pattern above), view their account status, plan status, subscription status — to actually resolve support requests without raw database access.
4. **Business metrics**: conversion funnel (signup → onboarding complete → plan generated → first week retained), referral performance (ties to doc 04 of the prior roadmap), engagement trends.

### Build vs. buy
Building a full custom admin UI is a meaningful investment. Consider:
- **Retool / Appsmith** (the latter open-source/self-hostable) — internal-tool builders that connect directly to Postgres and can produce a working admin dashboard far faster than custom React screens, at the cost of a less-branded feel (which is fine for an internal tool).
- A **lightweight custom screen** within the existing app, gated by an `is_admin` flag/role check — appropriate if the needs stay simple (a handful of read-only views plus a search box).
**Recommendation**: start with the lightweight custom approach for the operational/support views (fast, no new vendor), and revisit Retool/Appsmith only if the admin surface grows complex enough to justify the integration overhead.

---

## 5. Dark/Light Mode (Ticket #15)

### This is the most mechanical ticket in the batch — and a good "quick win"
Tailwind CSS (already in use, per the codebase) has first-class dark-mode support via the `dark:` variant. The standard, well-trodden implementation pattern:
1. Configure Tailwind's `darkMode: 'class'` strategy (gives explicit user control, vs. `'media'` which only follows system preference).
2. Store the user's preference in `localStorage` (and optionally sync to their profile row for cross-device consistency — a nice touch given FitPath already has user profiles).
3. Default to `prefers-color-scheme` on first visit, then respect explicit overrides.
4. **Add an anti-flicker inline script** in the document head that applies the stored theme *before* the page renders — without this, users see a "flash of wrong theme" on every load, which is the most common complaint about poorly-implemented dark mode.
5. Audit existing components for hardcoded colors (`bg-white`, `text-gray-900`, etc.) and convert to theme-aware Tailwind classes (`bg-white dark:bg-gray-900`) — this is the actual bulk of the work; the toggle mechanism itself is simple, but **touching every screen consistently is the real time cost**.

### Recommended sequencing
This has no dependencies on anything else in this batch and is **low-risk, high-visibility** — a good candidate to slot in whenever there's a natural lull between larger feature builds, or as an early "quick win" in the release to build momentum.

---

## 6. User & Journey Metrics / Product Analytics (Ticket #16)

### Tool comparison
| Tool | Free tier | Notes |
|---|---|---|
| **PostHog** | **Most generous** — 1M events/month free | Open-source option available (self-host); combines analytics, session replay, feature flags, and A/B testing in one product — arguably the best fit for a resource-conscious early-stage team that wants one tool covering several future needs |
| **Mixpanel** | Smaller free tier | Best-in-class funnel/retention analysis UI; a strong choice if the team outgrows PostHog's analytics depth |
| **Amplitude** | Smaller free tier | Similar positioning to Mixpanel; strong in product-led-growth-focused companies |

**Recommendation**: **PostHog** — the free tier is generous enough to comfortably cover FitPath at its current and near-future scale, and bundling analytics + session replay + feature flags in one tool avoids accumulating multiple vendor relationships during a resource-constrained phase. ([PostHog pricing](https://posthog.com/pricing))

### What to actually measure (the "make data useful to iterate" part of the ticket)
Raw event counts are not insight — design the tracking plan around the **specific questions FitPath needs answered**:
1. **Onboarding funnel**: where do users drop off between signup → questionnaire completion → plan generation → first task completion? (This is *the* highest-leverage funnel for an app whose core value is "AI generates your plan.")
2. **Activation**: what's the minimum set of actions in week one that correlates with a user still being active in week four? (This becomes the team's internal definition of "activated user" — the single most useful metric for prioritization.)
3. **Retention curves**: cohort-based retention (do week-2 cohorts retain better than week-1 cohorts as the product improves?) — the standard way to know if changes are actually working, as opposed to vanity metrics like total signups.
4. **Feature-level engagement**: which planned features (buddy system, vitals tracking, only-tracking mode) actually get used after the initial novelty period? This directly informs which of the 18 tickets in *this very batch* deserve the next round of investment.

### Privacy note (ties back to the compliance work)
Product analytics tools capture behavioral data — this needs to be disclosed in the privacy policy (prior roadmap, doc 01) and ideally should avoid capturing health-data values themselves (track *that* a user logged a vital, not *what* the value was) — keep analytics about product usage patterns, not about the sensitive health content itself.

---

## Suggested internal sequencing for this doc's six tickets
1. **Dark mode (#15)** — quick win, no dependencies, good for early-release momentum.
2. **Product analytics (#16)** — should go in *early* in the release cycle so that the rest of the release's features can actually be measured as they ship (instrumenting after the fact means losing the "before" baseline).
3. **RLS audit in lieu of encryption (#11)** — a focused audit task, not a big build; do it once and feed findings into the admin-dashboard access-control design.
4. **Image uploads (#9)** — natural extension of the profile-image work already planned in the prior roadmap; can ship independently.
5. **Admin dashboard (#12)** — start lightweight; let real support/ops needs (which will become clearer once analytics (#16) is live) shape what gets built next.
6. **Offline-first logging (#7)** — sequence this *with or after* the mobile app work (doc 02), where the use case is strongest.

---

## Sources
- [Supabase: Vault (secrets/encryption guidance)](https://supabase.com/docs/guides/database/vault)
- [PostHog Pricing](https://posthog.com/pricing)
- [Tailwind CSS: Dark Mode](https://tailwindcss.com/docs/dark-mode)
- General research synthesis on WatermelonDB / PowerSync / Legend-State sync-engine positioning for Supabase-backed React Native apps, and Retool/Appsmith as internal-tool builders for admin dashboards.

*Note: vendor free-tier limits and pricing change frequently — re-verify PostHog/Mixpanel/Amplitude and PowerSync pricing directly before committing budget.*
