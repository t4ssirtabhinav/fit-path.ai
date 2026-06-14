# FitPath — App Summary for External Analysis

*Prepared June 2026. Intended as input for third-party AI analysis covering competitive positioning, trademark/IP considerations, and terms-of-use / privacy-policy drafting. Reflects the live product as of this date plus a documented roadmap of planned features. Where figures or legal framing are noted as "draft" or "pending review," treat them as placeholders, not final positions.*

---

## 1. Product Overview

**Name**: FitPath (product/brand also referred to as "FitPath.ai" in marketing contexts, reflecting its AI-driven core).

**Tagline**: "Your holistic fitness journey starts here." Positioning statement used internally: *"A plan built around your life, not a generic template."*

**What it is**: FitPath is a web application (React/TypeScript SPA backed by Supabase) that generates a **personalized, AI-written, multi-domain fitness and wellness plan** — combining workouts, diet/nutrition, supplements, and habits into a single integrated daily plan — and then helps the user actually follow it day-to-day through a daily checklist, structured logging, streak tracking, and a built-in 1:1 accountability partner ("buddy") system.

**Target users**: General consumers seeking structured fitness/health guidance without hiring a personal trainer or nutritionist. Onboarding and nutrition guidance are explicitly India-aware (Indian cuisine/food references, India-relevant supplement/budget framing), suggesting an initial India-first go-to-market, with the product otherwise generally applicable to any English-speaking market.

**Business model**: Not yet finalized/implemented in-product (no billing/paywall code present). Currently free during beta. Competitor research (see §5) explicitly flags pricing/paywall fatigue as an industry-wide pain point and a potential point of differentiation ("perceived as fair on pricing for longer").

**Current stage**: Pre-launch/beta. Core product loop (onboarding → AI plan generation → daily tracking → progress/streaks → buddy accountability) is fully implemented and functional. Legal/trust pages (About, Contact, Privacy Policy, Terms of Use) exist but are explicitly marked as drafts pending formal legal review. No company has yet been incorporated; trademark/domain registration not yet pursued (see §6).

---

## 2. Comprehensive Feature List (Currently Built & Shipped)

### 2.1 Onboarding (two distinct paths)
- **"Plan" path**: User answers a guided questionnaire and receives a full AI-generated multi-week plan.
- **"Track" path**: User who already has their own routine skips AI plan generation and instead gets a configurable daily tracking checklist (`tracking_config`-driven), with no AI-authored plan content. This serves users who want logging/accountability tooling without being told what to do.
- **8 selectable "modalities" (goal areas)**, each with its own tailored questionnaire and AI prompt-shaping logic:
  1. **Gym / strength training** — experience level, equipment access, sessions/week, focus areas
  2. **Yoga** — experience, session length, style, goals
  3. **Cardio** — baseline fitness, preferred activities, goal, sessions/week
  4. **Home workouts** — available equipment, space constraints, fitness level, focus areas
  5. **Physiotherapy / rehab** — reason, target areas, duration, whether working with a professional
  6. **Diet & nutrition** — diet type, dietary goal, cuisine preferences (India-aware)
  7. **Supplements** — current supplements, goals, monthly budget, vegetarian-source preference
  8. **Other health concerns** — free-form concern list, medication status
  - Users can select **multiple modalities simultaneously** (e.g., gym + diet + supplements), and the AI plan integrates all selected areas into one coherent weekly schedule — this cross-modality integration is a structural differentiator (see §4).
- **Mandatory medical disclaimer** at signup: user must explicitly check a box agreeing that FitPath provides general guidance only, is not medical advice, and that they should consult a healthcare professional — gates both email and Google sign-up.

### 2.2 AI Plan Generation
- Powered by **Google Gemini** (`gemini-3-flash-preview`) via a Supabase Edge Function (`generate-plan`), using Gemini's native structured/JSON output mode.
- Output is validated against a strict **Zod schema** before being persisted — malformed AI output is rejected rather than shown to users.
- **Medical-safety guardrails**: a defined set of "major medical concerns" (PCOS, thyroid conditions, diabetes risk, high blood pressure, high cholesterol) automatically triggers a required "consult your doctor" note in the generated plan — the AI cannot silently omit this.
- **Country/region-aware nutrition rules**: diet recommendations adapt to the user's stated cuisine/region (India-aware food suggestions rather than generic Western defaults).
- **Allergy-avoidance enforcement**: user-declared allergies are factored into meal/supplement suggestions.
- **Prompt-injection sanitization**: free-text user inputs are sanitized before being interpolated into the AI prompt, mitigating prompt-injection risks.
- **Exercise naming quality control**: prompt guidance explicitly forbids generic/placeholder exercise names (e.g., "Compound Movement," "Isolation Exercise"), requiring specific, real exercise names — a recent quality fix.
- **Per-exercise type tagging** (`exercise_type: 'reps_weight' | 'duration'`): the AI tags each prescribed exercise as either a traditional sets/reps/weight exercise (gym/home/physio) or a duration-based activity (yoga holds, cardio sessions) — driving differentiated logging UI (see 2.3).
- **30-day plan-regeneration rate limit**: prevents excessive AI usage/cost per user and encourages commitment to a plan rather than constant regeneration.

### 2.3 Daily Tracking & Logging ("Today" / Dashboard)
- A **daily checklist** is generated from the AI plan (for "plan" users) or from a configurable tracker set (for "track" users), covering categories like workouts, meals, supplements, habits, sleep, mood, water intake, and body measurements.
- **Per-task inline structured logging** — each checklist item exposes an input type matched to what it's tracking, not just a generic checkbox:
  - **Numeric** inputs (e.g., glasses of water, step count) with units
  - **1–5 rating** inputs (e.g., mood/energy)
  - **Free-text notes** (e.g., meal/habit reflections)
  - **Measurement** entry (opens the body-weight/measurement modal)
  - **Exercise logging** (opens the structured workout logger described below)
  - Logging a value automatically marks the task complete; a simple checkbox toggle remains available for quick completion without detail.
- **Dynamic, exercise-type-aware workout logging**: each prescribed exercise for the day is shown as a **collapsible line item**; expanding it reveals:
  - For **reps/weight exercises** (gym, home, physio): a sets × reps × weight grid.
  - For **duration-based exercises** (yoga, cardio): a duration-in-minutes field plus optional notes (e.g., "how it felt," pacing/distance details) — avoids showing a meaningless sets/weight grid for a 20-minute cardio session or a 45-second yoga hold.
  - A heuristic fallback (`getExerciseType`) infers the correct type for plans generated before this field existed, so existing users' plans render correctly without regeneration.
- Backed by dedicated `task_logs` (value/notes per checklist task) and `exercise_logs` (structured sets, duration, notes, with a `source` flag distinguishing plan-prescribed vs. user-added custom exercises) tables.
- A general "Log notes" entry point remains for free-form daily reflections not tied to a specific task (illness, general comments).

### 2.4 Plan View
- Full view of the AI-generated multi-week plan (workouts, meals, supplements, habit guidance) — the "what's the plan" reference distinct from the day-to-day "Today" checklist.

### 2.5 Progress Tracking
- Streak tracking (consecutive days of plan adherence).
- Historical log view across tracked metrics and completed tasks.

### 2.6 Buddy / Accountability System
- 1:1 accountability partner pairing via **shareable invite codes/links** (`/join/:code`).
- Designed to combat the well-documented "solo-use burnout" problem in fitness apps (see §5) by giving every user a built-in accountability partner without requiring a broader social graph or community feature.

### 2.7 Authentication & Account Management
- Email/password signup with **mandatory email verification** (resend-verification flow included) and **Google OAuth (SSO)** sign-in.
- Password reset flow (forgot-password → emailed reset link → reset-password page), using Supabase Auth's built-in reset-token mechanism.
- Profile management: edit profile details, avatar upload, change password.
- **Data export** (JSON download of user data) and **full account deletion** — built for privacy-compliance posture (relevant to GDPR/India's DPDP Act framing).
- Tracking configuration management for "track"-path users.

### 2.8 Trust, Safety & Legal Surfaces (newly added)
- Public **About** page — positions FitPath as a "structure-and-motivation tool, not a medical service," with explicit beta framing.
- Public **Contact** page — support@fitpath.ai, stated 1–2 business day response time, explicit "not for medical emergencies" notice.
- Public **Privacy Policy** — discloses categories of data collected (account info, health profile/questionnaire responses, activity/exercise logs), names **Google Gemini as a sub-processor** for plan generation (noting no model-training use per Google API terms), **Supabase** as infrastructure/database provider, and **Sentry** for error monitoring; describes user export/delete rights. Explicitly marked **"draft, pending legal review, last updated June 2026."**
- Public **Terms of Use** — acceptable use policy, "not medical advice" framing, AI-generated-content disclaimer (output may be inaccurate, user is responsible for verifying suitability), limitation of liability, account termination conditions. Also explicitly marked **"draft, pending legal review."**
- A shared `LegalFooter` component links these pages from Login, Register, Forgot Password, and Profile pages (and is publicly accessible regardless of authentication state).

### 2.9 Platform / Engineering Posture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS (dark-themed UI; emerald-green accent color; dumbbell icon as the current logo mark).
- **Backend**: Supabase (PostgreSQL database, Auth, Edge Functions on Deno runtime, Storage for avatars).
- **AI provider**: Google Gemini API (`gemini-3-flash-preview`), accessed server-side only (via Edge Function), with structured-output validation.
- **Error monitoring**: Sentry.
- **Architecture**: Recently underwent a "layered architecture migration" (repository/service layering for data access), improving maintainability ahead of scaling.
- A `0` TypeScript-error baseline is maintained (`tsc --noEmit` clean) as a quality gate.

---

## 3. Highlighted / Core Features (the "headline" capabilities)

1. **One AI-generated plan that integrates multiple goal areas** — workouts, diet, supplements, and habits — into a single coherent weekly schedule, rather than separate disconnected modules.
2. **8-modality, multi-select onboarding** allowing combinations like gym + diet + supplements + physio rehab in one plan.
3. **Medical-safety-aware AI**: automatic "consult your doctor" guidance for users with flagged conditions (PCOS, thyroid, diabetes risk, high BP, high cholesterol), built into the plan-generation pipeline itself (not just a generic disclaimer).
4. **India-aware nutrition personalization** — cuisine-appropriate meal suggestions, addressing a commonly-cited gap in Western-built nutrition apps.
5. **Exercise-type-aware structured logging** — the logging UI adapts to whether an exercise is a strength set (reps/weight) or a duration-based activity (cardio/yoga), with per-task logging matched to data type (numeric, rating, notes, measurement, exercise).
6. **Built-in 1:1 "buddy" accountability system** via simple invite-code pairing — no broader social network required.
7. **Dual onboarding paths** ("plan" vs. "track-only") — serves both users who want to be told what to do and users who already have a routine and just want tracking/accountability tooling.
8. **Privacy-forward account controls**: full data export and account deletion available to users directly.

---

## 4. Unique Features / USPs (Differentiators)

Based on direct competitive research (see §5 for sources), FitPath's combination of features occupies a gap not fully owned by any single major competitor:

- **MyFitnessPal / Cronometer / HealthifyMe** are nutrition-first with no integrated workout-plan generation or built-in accountability layer.
- **Fitbod / JEFIT** are workout-first AI personal trainers with no diet/supplement/habit integration and no social accountability.
- **Noom** is behavior-change-first but relies on scripted, impersonal "coaching" and is priced at a premium (~$199+/year).
- **Strava** is social/community-first but oriented around activity tracking for endurance sports, not AI plan generation.
- **Fittr** (India) pairs technology with human coaches and community but lacks AI-personalization speed, India-aware logging convenience, and (notably) photo meal logging — manual logging of home-cooked Indian meals is a cited cause of user abandonment.

**FitPath's positioning**: *"One AI-generated plan that actually integrates diet + workout + supplements + habits for your specific life — paired with a built-in accountability partner, not a faceless community."* The **buddy/1:1-accountability mechanic combined with cross-modality plan integration and India-aware onboarding** is, per this research, not fully replicated by any single competitor. The buddy mechanic in particular is considered FitPath's most defensible, hardest-to-copy asset — Strava is the only competitor with a comparable social hook, and it is endurance-sport-specific rather than plan-and-habit-specific.

**Additional differentiators**:
- **Exercise-type-aware logging** (duration vs. reps/weight, auto-detected even for legacy plans) — a level of UI/data-model nuance not commonly highlighted by competitors.
- **"Track-only" mode** — most competitors assume the AI/plan is the product; FitPath explicitly supports users who don't want an AI-generated plan at all but do want structured daily tracking and accountability.
- **Medical-condition-aware AI guardrails baked into the generation pipeline** (not just a blanket disclaimer banner) — the plan content itself changes/adds disclaimers based on declared conditions.

**Strategic note for positioning**: Internal research recommends validating two possible brand narratives — *"AI plan that adapts to your life"* (competes with Fitbod/Noom on personalization, but AI plan generation is expected to commoditize as foundation models improve) vs. *"Never do it alone"* (competes with Strava/Fittr on accountability — considered the more defensible long-term moat since a genuine social-accountability product is harder to copy quickly than AI plan generation).

---

## 5. Competitive Landscape Reference (for analysis input)

| Competitor | USP | Known weaknesses/criticisms |
|---|---|---|
| MyFitnessPal | Massive food database; tracks calories/macros/weight/steps/exercise at scale | UI overhaul broke workflows; inaccurate crowdsourced data; free tier gutted, premium ~$24.99/mo |
| Noom | Color-coded food categorization + daily psychology lessons | Expensive ($199+/yr); "coaching" reported as scripted/bot-like; repetitive after month one |
| Fitbod | AI-personalized strength workouts based on goals, history, equipment, estimated recovery | Generally well-regarded; no major public complaints found |
| Strava | Social layer (segments, kudos, clubs, AI "Instant Workouts") | Social graph/segment data is a near-unreplicable moat for others, but not a weakness of Strava itself |
| Whoop | Recovery-readiness framing via wearable + subscription | Hardware + mandatory subscription criticized; 2025 backlash over broken hardware-upgrade promises |
| Cronometer | Deep micronutrient tracking with exportable data | Appeals to analytically-minded niche, not mass market |
| JEFIT | 1,400+ exercises w/ demo videos, AI progressive-overload recommendations | — |
| HealthifyMe (India) | Indian-food database (10,000+ items), AI coach "Ria," photo meal logging | Free tier extremely limited; AI features paywalled at ~₹999/mo |
| Fittr (India) | Tech + real human coaches + founder-led community | No photo meal logging; manual logging of home-cooked meals cited as a major 2026 abandonment driver |

**Cross-industry patterns relevant to positioning**:
- Successful apps tend to own one clear mental model (Noom = behavior change, Whoop = recovery, Strava = social competition, Fitbod = AI strength coaching).
- Paywall resentment is near-universal once apps reach scale — an opening for FitPath to be perceived as fair-priced for longer.
- "Impersonal AI coaching" is a recurring complaint — users want personalization that feels like it's looking at *their* data, not running a script (relevant to how FitPath should message its Gemini-based plan generation).
- Logging friction for home-cooked/regional food is a named gap that India-aware apps can address.
- Solo-use burnout (no built-in accountability) is a quiet, chronic churn driver across nearly all competitors except Strava.

---

## 6. Branding, Trademark & IP Considerations (for analysis input)

- **Brand name in use**: "FitPath" (also "FitPath.ai" in some contexts). **No trademark search, registration, domain-conflict check, or company incorporation has been completed yet** — internal research (India-focused) recommends:
  - Running a combined trademark database + web/app-store search for "FitPath" and close variants *before* finalizing name/logo/domain as one identity package, since a post-launch name clash is costly to fix.
  - Registering Udyam/MSME status first (unlocks a reduced trademark filing fee of ₹4,500/class vs. ₹9,000/class in India).
  - Filing for trademark protection early and in parallel with incorporation, given India's multi-month-to-over-a-year trademark processing timeline — the brand is currently unprotected.
  - Likely relevant trademark classes: Class 9 (software/apps), possibly Class 41/44 (fitness/health services).
  - Verifying licensing terms for all visual assets (icons, illustrations, any future exercise-demo media) before shipping — flagged as a recurring risk area for fitness apps specifically.
- **Current visual identity**: dark UI theme, emerald-green accent color, dumbbell icon as the logo mark (Lucide icon library) — no custom logo/brand asset has been independently verified for trademark conflicts.
- **No company entity yet incorporated**. If external funding is a realistic possibility, research recommends registering as a **Private Limited Company** (India) from the outset rather than an OPC/LLP, since most India startup funding programs require this structure and later conversion adds cost/delay.

---

## 7. Data, Privacy & Terms-of-Use Considerations (for analysis input)

Relevant facts for drafting/refining Terms of Use and Privacy Policy (current drafts exist but are explicitly marked pending legal review):

- **Data collected**: account/profile info (name, email, avatar), health/fitness questionnaire responses (including potentially sensitive health information — medical conditions, allergies, medications), daily activity/exercise/nutrition logs, body measurements, mood/energy ratings.
- **Sensitive health data**: the app explicitly collects information about medical conditions (PCOS, thyroid, diabetes risk, high BP, high cholesterol, allergies, "other health concerns," medication use). This is "special category"/sensitive personal data under most privacy frameworks (GDPR Art. 9; India's DPDP Act treats health data with heightened obligations) — Terms/Privacy drafting should account for this explicitly, including legal basis for processing and any required consent flows beyond the current medical-disclaimer checkbox.
- **Third-party sub-processors currently in use**:
  - **Google Gemini API** — receives user questionnaire data to generate plans; per Google API terms, not used for model training (this representation should be verified against current Gemini API terms before publishing).
  - **Supabase** — database, authentication, file storage (avatars), and edge function hosting; effectively the core infrastructure/data-residency provider.
  - **Sentry** — error/crash monitoring (may capture portions of application state/stack traces).
  - **Google OAuth** — used for "Sign in with Google," involving Google as an identity provider.
- **User rights already implemented in-product**: data export (JSON) and full account deletion — supports GDPR "right to access/portability" and "right to erasure," and India DPDP Act data-principal rights, though formal policy language should reflect the actual implementation and response SLAs.
- **AI-generated content disclaimer**: Terms draft already states plan content may be inaccurate and is not medical advice, and users are responsible for assessing suitability — this should be retained and likely strengthened given the health-data context.
- **Geography**: product and legal research to date is India-focused (DPDP Act, MCA/trademark process), but the product itself is not geographically restricted — Terms/Privacy should clarify target jurisdictions and which law governs, and consider whether GDPR (EU users) or other regional frameworks (e.g., US state health-data laws) need to be addressed if the user base is not India-only.
- **No payment/billing system is implemented yet** — Terms currently need no payment-terms section, but this will need to be added before any paid tier launches.
- **Account security**: email verification required, password reset via emailed token, Google OAuth as an alternative — no current "sign out of all sessions" / active-sessions management feature (planned, see §8).

---

## 8. Planned Features for Upcoming Releases (Roadmap)

The following are documented as planned (not yet built), drawn from the project's prioritized roadmap (`docs/planning/07-beta-priority-matrix.md`) and deeper research docs (`docs/planning/next-release/`). Listed roughly in priority order (Tier 2 = next after current beta-readiness work, Tier 3 = longer-term).

### Near-term (Tier 2)
- **Reporting & dashboards** — richer analytics/scoring views on top of existing logs.
- **Self-service, AI-validated plan adjustments** — users can request changes to their existing plan and have an AI validate/apply them, rather than only full regeneration.
- **Pre-login landing page / carousel** — a marketing/onboarding experience for visitors before they sign up (currently visitors land directly on Login).
- **Loyalty & rewards system** ("Consistency Score") — gamified recognition for adherence.
- **"Tip of the Day"** — lightweight daily engagement content.
- **Weekly summary / re-engagement emails** — requires integrating an email-sending provider (Resend has been identified as the candidate).
- **Active-sessions management / "sign out everywhere"** — security feature for account management.
- **PR ("Personal Record") detection** — automatically recognize and celebrate when a user beats a previous best in logged exercises.
- **Custom/ad-hoc exercise logging** — users can log exercises not in their AI-generated plan.
- **Generalized "logged segment" data model extended across modalities** — e.g., yoga hold-time, cardio distance/pace, beyond the current reps/weight/duration model.

### Mid-term / research-stage (Tier 3 and `next-release` research docs)
- **AI-powered meal/macro extraction from free-text logs** — deferred pending usage/cost-tracking infrastructure due to per-use AI cost concerns.
- **WhatsApp integration** — verified mobile number (E.164 format) linkage for daily plan delivery, reminders, and two-way check-in logging via WhatsApp messages. Identified as a long-scope, journey-map-first initiative.
- **Mobile apps & wearables** — native/companion mobile experience and wearable-device data integration (research-stage; see `docs/planning/next-release/02-mobile-apps-and-wearables.md`).
- **Menstrual cycle tracking** — a dedicated tracking modality (research-stage; `docs/planning/next-release/06-menstrual-cycle-tracking.md`).
- **Workout library + AI-generated video content** — a browsable exercise/content library, potentially including AI-generated instructional video (research-stage; `docs/planning/next-release/05-workout-library-and-ai-generated-video-content.md`; note this research also raised exercise-content licensing considerations relevant to §6).
- **Buddy groups & leaderboards** — extending the current 1:1 buddy system to small groups with competitive elements.
- **Referral system** — user-driven growth mechanic.
- **Full tagged content library** — broader educational/content surface beyond the current plan-focused experience.
- **Plan-generation fallback / weighted matching** — improved resilience/fallback logic if AI generation fails or produces low-confidence output.
- **Platform/offline storage, admin tooling, and UI improvements** — internal/operational improvements (research-stage; `docs/planning/next-release/04-platform-offline-storage-admin-and-ui.md`).
- **Engagement notifications, summaries, and plan-adjustment flows** — broader notification infrastructure (research-stage; `docs/planning/next-release/03-engagement-notifications-summaries-plan-adjustment.md`).
- **Business/legal/branding formalization (India)** — company incorporation, trademark filing, domain/brand conflict resolution (research-stage; `docs/planning/next-release/07-business-legal-branding-india.md`, summarized in §6 above).
- **Hosting platform & funding research (India)** — infrastructure scaling and startup funding program eligibility (research-stage; `docs/planning/next-release/08-hosting-platform-and-funding-india.md`).

---

## 9. Summary for Downstream AI Prompts

When using this document as input to another AI for competitive analysis, trademark/IP review, or terms-of-use drafting, the key facts to anchor on are:

1. FitPath is an **AI-personalized, multi-domain (workout + diet + supplements + habits) fitness planning and tracking app**, currently in **pre-launch beta**, India-first but not geographically restricted.
2. Its core differentiation is the **combination** of cross-modality AI plan integration + a **built-in 1:1 accountability ("buddy") system** + India-aware personalization — not any single feature in isolation.
3. It **collects sensitive health data** (medical conditions, allergies, medications) and uses a **third-party LLM (Google Gemini)** to process that data for plan generation — this is the central fact for privacy/terms drafting.
4. The brand name "FitPath"/"FitPath.ai" has **not yet been trademark-cleared, domain-locked, or attached to an incorporated company** — this is an open risk area, not a settled asset.
5. A substantial, already-researched roadmap exists (Tier 2/3 items above) — useful for forward-looking competitive positioning, but **none of it is built yet**; only Sections 2–4 above describe the shipped product.
