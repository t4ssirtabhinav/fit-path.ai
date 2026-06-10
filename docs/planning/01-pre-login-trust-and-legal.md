# Plan: Pre-Login Experience, Trust Building & Legal/Compliance

Covers tickets **#1 (landing/carousel), #5 (compliance research), #6 (footer & legal pages)**.

Current state: there is no landing page — `/` redirects straight to `/login` (App.tsx:95-101). The only "trust" surface today is the medical disclaimer shown at signup and in a few other spots. No Privacy Policy, Terms, About, or Contact pages exist anywhere.

---

## 1. Landing / Pre-Login Experience (Ticket #1)

### Goal
Replace the immediate redirect-to-login with an experience that (a) builds an emotional hook in the first 2-3 seconds, (b) shows what the app actually looks like and does, and (c) gets the visitor to sign up or log in without friction.

### Proposed structure (3 layers, all on one route, e.g. `/welcome`)

**Layer 1 — Brand intro animation (one-time per session/device)**
- Logo/wordmark animates in, briefly "zooms out" to reveal it's actually the first frame of the carousel behind it (a single continuous motion, not two separate screens — this is what makes it feel premium rather than like a loading splash).
- Keep it short: 1.2–1.8s. Add a "skip" tap-anywhere affordance after ~600ms so repeat visitors aren't trapped.
- Respect `prefers-reduced-motion` — fall back to a simple fade.
- Persist a flag (`localStorage: hasSeenIntro`) so returning visitors land directly on the carousel, not the animation, on subsequent visits within some window (e.g. 30 days).

**Layer 2 — Full-page scrollable/swipeable carousel**
- 4-6 panels, each pairing a real (or high-fidelity mock) screenshot with one short, benefit-oriented headline + sub-line. Suggested narrative arc:
  1. "Tell us about you" → onboarding screenshot — *"A plan built around your life, not a generic template"*
  2. "Your day, simplified" → Today page — *"One checklist. Workouts, meals, supplements, habits — all in one place"*
  3. "See yourself improve" → Progress page charts — *"Watch your trends, not just your weight"*
  4. "Never go it alone" → Buddy page — *"Pair up, compare streaks, keep each other honest"*
  5. "Plans that adapt" → Plan page — *"AI-generated, phase-based plans that evolve with your goals"*
  6. (Optional closer) social proof / mission statement panel — *"Built for people who want structure without a personal trainer's price tag"*
- Interaction: support both swipe/drag (mobile) and arrow/dot navigation (desktop), plus auto-advance with pause-on-interaction. Avoid forcing the user to "finish" the carousel before acting — the CTA buttons are visible from panel 1 onward.
- Visual treatment: device-frame mockups (phone bezel) around real screenshots feel more trustworthy than raw crops; subtle parallax between the screenshot layer and text layer adds polish cheaply.

**Layer 3 — Persistent header CTA**
- Top-right: "Log in" (text/ghost button) + "Sign up" (filled/primary button), both fixed/sticky across all carousel panels, routing to existing `/login` and `/register`.
- On mobile, collapse to a single primary "Get started" CTA plus a smaller "Log in" link to avoid cluttering a narrow header — secondary action can live in the carousel's last panel too.

### UX ideas worth considering
- **Progressive disclosure of value, not features**: lead each panel with the *outcome* the user gets, with the screenshot as supporting evidence — not "Here is the Buddy page" but "Never go it alone."
- **Social proof panel**: even lightweight ("Join people building consistent habits") beats nothing; revisit once you have real numbers/testimonials.
- **Deep-linkable CTAs**: if a marketing campaign sends someone to `/welcome?intent=track` you could pre-select carousel panel 2 (tracking-oriented) vs panel 1 (plan-oriented) — small touch, large relevance gain later.
- **A/B-testable CTA copy**: "Get started free" vs "Build my plan" vs "Start tracking" — keep the routing logic decoupled from copy so you can iterate without code changes (e.g. drive copy from a config object/remote flag).
- **Returning-user shortcut**: if a Supabase session already exists (token in storage but app hasn't validated it yet), skip the landing entirely and go straight to the dashboard — don't make logged-in users sit through marketing.

### Implementation notes (for later, not now)
- New route `/welcome` (or repurpose `/`), gated by an `App.tsx` check: unauthenticated + first visit → landing; unauthenticated + returning → carousel only (skip intro animation); authenticated → dashboard.
- Animation: Framer Motion (already a natural fit with React 18) or CSS keyframes for the simplest version — avoid pulling in a heavy animation library just for this.
- Carousel: a lightweight library (Embla, Swiper) or a hand-rolled `scroll-snap` implementation — hand-rolled keeps bundle size down and matches the existing "custom UI components" pattern (Button/Card/Input are all bespoke).
- Screenshots: capture from the actual app in a clean demo account (avoid real user data) and keep them as static assets that get refreshed when major UI changes ship — stale screenshots erode trust faster than no screenshots.

---

## 2. Compliance, Privacy & Legal Research (Ticket #5)

### Why this matters here specifically
FitPath collects health data (weight, height, vitals, goals, medical concerns, injuries) and feeds it to a third-party AI (Gemini) to generate plans. That combination — **health data + AI processing + a consumer-facing app** — sits squarely inside the more sensitive end of privacy regulation, even pre-revenue. Getting the foundational consent/disclosure pieces in place now is much cheaper than retrofitting later (especially because retrofitting often means re-consenting an existing user base, which is its own UX problem).

### What kind of data is in scope (from the codebase audit)
- **Account/PII**: email, display name, country, timezone (in `profiles`, `auth.users`)
- **Health data**: age, gender, weight, height, body measurements, vitals comments, sleep, stress, hydration, injuries, medications, "health concerns" free text (`health_profiles`, `daily_logs`, `body_measurements`)
- **Behavioral data**: task completion, streaks, plan history (`task_logs`, `streaks`, `plans`)
- **Social data**: buddy relationships, invite codes
- **AI-derived data**: full generated plans containing inferred health/fitness assessments

Health data in particular is treated as a "special category"/"sensitive" class under most major frameworks (GDPR Art. 9, India's DPDP Act, US state health-privacy laws like Washington's My Health My Data Act), which generally require **explicit, specific consent** — a pre-ticked box or a buried clause in a ToS is not sufficient.

### Areas to research and the documents/mechanisms each implies

| Area | What it covers | Resulting artifact(s) |
|---|---|---|
| **Privacy Policy** | What data is collected, why, how long it's kept, who it's shared with (incl. Google/Gemini as a sub-processor), user rights (access/export/delete — export & delete already exist!), how to contact about privacy | `/privacy-policy` page |
| **Terms & Conditions** | Acceptable use, medical-advice disclaimer (already exists in spirit), liability limitations, account termination, dispute resolution | `/terms` page |
| **AI-specific consent** | Separate, explicit consent for "your data will be sent to a third-party AI service to generate your plan" — distinct from general privacy consent because users may not expect this | A dedicated checkbox/screen at signup or first plan generation, logged with a timestamp |
| **Data minimization & PII separation** | Whether health/behavioral data sent to the AI provider needs to be de-identified (no name/email in the prompt — worth verifying the current `generate-plan` function strips these) | Engineering review + documented data-flow diagram |
| **Encryption & storage safeguards** | At-rest encryption (Supabase/Postgres defaults — verify), in-transit (HTTPS — already default), and whether especially sensitive fields (medications, health concerns) warrant column-level encryption | Security review; possibly a migration adding `pgcrypto`-based encrypted columns for the most sensitive free-text fields |
| **Consent record-keeping ("proof stays with us and the user")** | A `consents` table logging: user id, consent type (privacy/terms/AI-processing/marketing), version accepted, timestamp, IP (optional) — gives you an audit trail if ever challenged, and the user can see their own consent history in their data export | New table + surfaced in the existing data-export feature |
| **Regional applicability** | Decide upfront which regimes you're designing for — at minimum: GDPR (EU/UK visitors), India's DPDP Act 2023 (the app already has India-oriented onboarding fields like `country`), and US state laws (CCPA/CPRA, health-data laws). You don't need to be compliant with all of them on day one, but the consent/data-rights architecture should be flexible enough not to require a rewrite when you expand | A short internal "applicability memo" deciding initial scope |
| **Cookie/tracking disclosure** | If/when analytics or marketing pixels are added, a cookie banner becomes necessary in EU contexts | Deferred until analytics is added — flag as a dependency |
| **Data retention & deletion** | How long data is kept after account deletion (the delete feature exists — does it cascade fully, including from backups/logs?), and a stated retention period for inactive accounts | Policy decision documented in the Privacy Policy; verify deletion cascades in DB |
| **Children's data** | Decide and state a minimum age (commonly 16-18 for health apps) and add an age gate at signup if not already implicitly covered by the existing `age` field validation | Policy statement + signup validation rule |

### Suggested phased approach (research → minimum viable compliance → maturity)
1. **Phase 0 (now — research only, matches this ticket's scope)**: Produce the "applicability memo" (which regimes apply), a data-flow diagram (what data goes where, including to Gemini), and draft outlines for Privacy Policy / Terms — ideally reviewed by a lawyer or a service like Termly/iubenda before publishing, since AI-generated legal text carries real risk if wrong.
2. **Phase 1 (minimum viable)**: Publish Privacy Policy + Terms, add an explicit "your data may be processed by AI" consent checkbox at signup (separate from the existing medical disclaimer), create the `consents` audit table, verify the AI prompt doesn't leak PII.
3. **Phase 2 (maturity)**: Add consent-version tracking (so re-consent is triggered when policies change), expose consent history in the data export, consider column-level encryption for the most sensitive free-text fields, add a cookie banner if/when analytics ships.

### A practical note on cost
Generating compliant legal text is the one place in this whole roadmap where "free and DIY" carries real downside risk — a wrong clause in a Terms of Service or an inadequate health-data consent flow can create real liability. Budget for either a one-time consultation with a lawyer familiar with digital health products, or a reputable policy-generator service (Termly, iubenda, TermsFeed) as a low-cost middle ground, and treat anything AI-drafted as a first draft for review rather than a final artifact.

---

## 3. Footer & Static Pages (Ticket #6)

### Where it should appear
- **Profile page**: as requested — add a footer section below "Sign Out"/disclaimer with links to Privacy Policy, About Us, Contact Us.
- **Landing page, Login, Register**: add Contact Us (and ideally Privacy/Terms links near the disclaimer/CTA) so an unauthenticated visitor with a problem isn't stuck. `AppLayout.tsx:43` already has a desktop-only footer pattern to extend from.
- Consider a small shared `<LegalFooter />` component reused across all four surfaces rather than four bespoke implementations — keeps copy and links consistent when policies update.

### What each page should contain (research summary)

**Privacy Policy** — see compliance section above; this *is* the page that results from that research.

**Terms & Conditions** — see compliance section above.

**About Us** — typically covers: what the product is and who it's for, the mission/why it exists (the medical-disclaimer-heavy tone suggests positioning as "structure and motivation tool," not "medical service" — About Us is the place to make that framing explicit and warm rather than legalistic), and optionally a short note on the team/story for trust-building. Keep it short — most users skim this once.

**Contact Us** — typically covers: a support email (or simple contact form posting to an email/edge function), expected response time, and — given this is a health-adjacent app — a clear note that it is *not* for medical emergencies (with a pointer to local emergency services). A simple `mailto:` link is the zero-infrastructure starting point; a form backed by an edge function (writing to a `support_requests` table or forwarding via an email API — see the Emails plan in doc 06) is the more polished v2.

### Suggested order of operations
1. Write About Us & Contact Us first (low-risk, no legal review needed, unblocks the footer ticket immediately).
2. Gate Privacy Policy / Terms behind the compliance research above — publishing a placeholder "Coming soon" is worse than not linking it at all, since an empty legal page can itself look bad to a visitor evaluating trust.
3. Build the shared footer component once both are ready, and wire it into Profile, Landing, Login, Register.
