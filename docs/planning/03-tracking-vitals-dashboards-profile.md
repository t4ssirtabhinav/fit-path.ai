# Plan: Post-Signup UX, Vitals/Tracking Revamp, Reporting & Profile

Covers tickets **#9 (post-signup UX before onboarding), #10 (Today-page logging revamp), #11 (only-tracking parity), #12 (reporting/dashboarding/scoring), #13 (profile image)**.

This is the largest cluster — it touches the core daily-use loop. Recommend tackling it as its own mini-roadmap once prioritized, roughly in the order presented below (each builds on the data model the previous one establishes).

---

## 1. UX for Signed-Up-but-Not-Onboarded Users (Ticket #9)

### The question being asked
Should a verified user be allowed into the app's tabs before completing onboarding (seeing empty states with encouragement), or should onboarding remain a hard gate?

### Recommendation: soft gate with purposeful empty states
A hard gate (today's likely behavior, given `onboarding_complete` drives routing) is simpler but risks losing users at the highest-friction step — a multi-step health questionnaire is a big ask immediately after signup. Letting users *peek* at the app's value first, with empty states that sell the benefit of finishing onboarding, tends to convert better:

- **Dashboard (Today)**: instead of seeded tasks, show a card: *"Your personalized checklist will appear here once you finish setting up — takes about 3 minutes"* with a prominent CTA back into onboarding, plus maybe a generic "starter" habit or two (e.g. "Drink a glass of water," "Take a short walk") so the page doesn't feel completely dead.
- **Plan page**: *"No plan yet — tell us about your goals and we'll build one around your life"* with the CTA, and perhaps a glimpse of what a plan looks like (a blurred/sample preview) to build anticipation.
- **Progress page**: *"Nothing to show yet — once you start logging, your trends will show up here"* — pairs naturally with letting them log a first weight/vitals entry even pre-onboarding (see below).
- **Buddy page**: this one *can* work pre-onboarding (it's independent of plan data) — consider leaving it fully open, since connecting with a buddy early is itself a retention hook ("come back and finish setting up so I can see your progress").

### Key design decision: should logging work before onboarding completes?
Allowing early logging (weight, vitals) gives the user something to do and a reason to return — and the data isn't wasted, since `body_measurements`/`daily_logs` aren't onboarding-dependent. Recommend: **yes, allow it**, since it also seeds the Progress charts with real data by the time onboarding finishes, making the "first impression" of Progress less empty.

### Suggested mechanism
Add a lightweight banner/strip (dismissible per-session, reappearing on next login until onboarding completes) across all tabs: *"Finish setup to unlock your personalized plan — 3 min"* with a progress indicator if the user previously started onboarding and dropped off (the existing `last_onboarded_at` field could help detect "started but didn't finish" vs "never started").

---

## 2. Today-Page Logging Revamp — Vitals & Notes (Ticket #10)

### Why the current setup feels redundant
"Log weight" and "Log notes" are two separate entry points that both ultimately capture overlapping data (weight lives in the measurement modal; "vitals" — BP/HR/blood sugar — live as free-text inside the notes modal). The ticket correctly identifies that this should be unified into one coherent daily-logging experience, with **vitals promoted to first-class structured data** rather than text comments.

### Proposed model: a single "Log your data" entry point → categorized cards
Replace the two buttons with one **"Log"** action that opens a structured logging surface (could be a dedicated screen/sheet rather than a small modal, given how much it now needs to hold). Organize it into clearly separated sections:

1. **Vitals** (own card/section — logged independently, multiple times/day where it makes sense)
   - Heart rate (bpm)
   - Blood oxygen / SpO₂ (%)
   - Blood sugar (mg/dL or mmol/L — consider unit by locale/country, which the app already tracks)
   - Blood pressure (systolic/diastolic)
   - *(Weight is handled separately below — it's "once a day," not a multi-log vital)*

2. **Body measurements** (separate card, once-a-day cadence apart from height)
   - Weight (kg/lb)
   - Waist, chest, hips, arms, etc. — whatever the app wants to support beyond the current waist-only field
   - Height explicitly **excluded** — only editable via Profile, exactly as the ticket specifies (it changes essentially never for adults)

3. **Daily notes / comments** (the existing `daily_logs` content — workout comments, energy level, meals, supplements, illness, sleep, "other") — kept as **editable-for-the-day, single-entry-per-day** fields, matching current behavior. The ticket flags that the "workout comments" field may not suit every user — see personalization note below.

### Validation, guardrails & outlier detection (the meat of this ticket)

For each vital, define:
- **A plausible physiological range** (hard bounds — reject values outside, e.g. heart rate 30-220 bpm, SpO₂ 50-100%, systolic 60-250 mmHg). These are sanity bounds, not medical thresholds — frame messaging around "that doesn't look like a typical reading, please double check" rather than implying a diagnosis.
- **A personal-baseline outlier check**: compare a new entry against the user's recent rolling average (e.g. last 7-14 entries). If a new value deviates significantly (say, >2 standard deviations, or a simpler % threshold like ±25% from their recent average for a first pass), don't block the save — instead **interrupt with a confirmation**: *"This heart rate (142 bpm) is noticeably higher than your recent readings (avg. 78 bpm). Save it anyway?"* This respects that real outliers do happen (post-workout HR, illness) while catching likely typos (e.g. "780" instead of "78").
- **Logging cadence buffers** (the ticket's "buffer between vitals logs"): enforce a minimum gap between consecutive entries of the *same* vital type — e.g. 30-60 minutes for HR/SpO₂/BP/blood sugar — surfaced as a friendly "You logged this recently — want to update that entry instead, or wait a bit before adding another?" This prevents both accidental double-taps and intentional spam, without being so strict it blocks legitimate same-day re-checks (e.g. pre/post-workout HR, fasting vs. post-meal blood sugar).
- **One-per-day fields** (weight, body measurements other than height, and the daily-notes comments): enforce server-side via a unique constraint on `(user_id, date)` or an upsert pattern — attempting a second entry for the same day either updates the existing one (for editable fields like notes) or is blocked with a clear message (for weight, per the ticket: *"You've already logged your weight today — come back tomorrow!"*).
- **Immutability of vitals once logged** (explicit in the ticket: *"Vitals once logged can't be updated"*): this has a real implication for the outlier-confirmation UX above — since there's no "fix it after the fact," the pre-save confirmation step becomes the *only* safety net, so it needs to be genuinely good (clear comparison to recent data, an easy "edit before saving" affordance, and an unambiguous "this can't be changed later" notice in the confirmation dialog itself).

### Personalizing the "workout comments" field
Rather than a one-size-fits-all field, key the visible comment fields off the user's selected modalities/goals from onboarding (`activity_modalities`, already captured). E.g., a user who selected "diet" but not "gym" sees a meal-reflection prompt more prominently than a workout one; a "track only" user sees fields aligned to whatever they chose to track in `tracking_config`. Keep one **generic "anything else?" field** as a catch-all so nobody feels unable to log something that doesn't fit a category.

### Data model implications (for later — flagged here so the plan is grounded)
- New structured columns/table for vitals (likely a dedicated `vitals_logs` table: `user_id, type, value, unit, logged_at, created_at` — append-only, matching the "can't be updated" rule, with a partial unique index or trigger enforcing the cadence buffer) rather than continuing to store them as text inside `daily_logs`.
- `body_measurements` likely needs new columns (or a more flexible `measurements` jsonb/EAV-style structure) to support the additional measurement types beyond weight/waist.
- The "once a day" and "editable for the day" rules are best enforced with DB-level constraints (unique indexes, upsert patterns) backed up by client-side messaging — don't rely on client-side checks alone, since they're trivially bypassed.

---

## 3. Only-Tracking Feature Parity (Ticket #11)

### Current state
The "track" onboarding path exists and writes to `tracking_config`, but per the audit, tracking users get a notably thinner experience — no AI-generated plan, and the dashboard/logging experience isn't tailored to what they actually chose to track.

### Recommended approach: make the revamped logging surface (from #10) the shared backbone
Rather than building a parallel experience, design the vitals/measurements/notes revamp above to be **driven by `tracking_config` selections** for tracking-only users (and by plan content for plan-path users). Concretely:
- A tracking-only user who selected "workouts, meals, sleep, vitals" sees exactly those logging cards on their Today page — nothing more, nothing less — while a plan-path user sees logging cards that complement their generated plan's structure.
- The Today page's "task checklist" concept (currently seeded from `plans`) needs an equivalent for tracking users — likely simple recurring reminders/checkpoints derived from their chosen trackers and reminder times (`tracking_config.reminder_morning/evening`, currently captured but unused — this is a natural place to finally use them).
- Progress/reporting (#12 below) should likewise be driven by what the user actually tracks, not a fixed plan-oriented template.

### Functional gap analysis (what's implementable without platform/technical limitations)
- ✅ Structured vitals logging (shared with #10)
- ✅ Reminder notifications using the captured but unused `reminder_morning`/`reminder_evening` fields (push notifications would need a service — see note below; in-app/email reminders are achievable with current infrastructure)
- ✅ A tracking-tailored dashboard checklist (derived from `tracking_config` rather than `plans`)
- ✅ Streaks/gamification — already buddy/streak infrastructure exists and is tracker-agnostic
- ⚠️ Push notifications for reminders would require adding a push service (e.g. web push via service workers, or a mobile wrapper) — flag as a larger infrastructure decision, not a quick win; an email-based reminder (see doc 06) is the lower-effort substitute for v1.

---

## 4. Reporting, Dashboarding & Scoring (Ticket #12)

### Current state
`ProgressPage` already has a solid foundation: weight trend (AreaChart), weekly completion (BarChart), and an activity heatmap, all via Recharts.

### What to extend
1. **Per-data-type charts with range & chart-type switching**: generalize the existing chart components into a reusable `<MetricChart metric="heart_rate" range="weekly" type="line" />`-style component that can render any tracked metric (vitals, measurements, energy levels, etc.) across user-selectable ranges (day/week/month) and chart styles (line, bar, area). Recharts supports all of these natively — this is mostly a refactor-and-generalize exercise on top of what exists, not a new charting investment.
2. **Vitals-specific views**: dedicated trend lines per vital (HR over time, BP systolic/diastolic as a dual-line chart, blood sugar with time-of-day context, etc.) — each respecting the "can't be updated" immutability so the chart is a trustworthy historical record.
3. **A scoring/engagement system** (the ticket's specific ask — *"so users engage and... don't miss it"*): this overlaps significantly with ticket #15 (loyalty/rewards) — recommend designing them together rather than building two separate scoring concepts. A simple starting model: a daily "consistency score" derived from (a) % of planned tasks completed, (b) whether vitals/measurements were logged, (c) streak continuation — surfaced prominently on both Progress and Today pages, and feeding into the rewards system in doc 04.
4. **Comparative/contextual views**: e.g. "this week vs. last week," annotations on charts for milestones (plan phase changes, buddy connections) — small additions that make raw trend lines feel like a *story* rather than just data.

### Sequencing note
This ticket is naturally **downstream of #10/#11** — you need the structured vitals data model in place before you can chart it meaningfully. Plan it as phase 2 of this cluster.

---

## 5. Profile Image Upload (Ticket #13)

### Current state
No upload capability and no storage bucket configured (per audit). `ProfilePage` currently shows an initial-letter avatar circle.

### Recommended approach: Supabase Storage
This is one of the more contained, well-trodden pieces of this whole roadmap:
1. Create a `profile-images` (or `avatars`) **storage bucket** with RLS policies scoping read/write to the owning user (and public read if avatars should be visible to buddies — likely yes, since buddy cards already render initials in place of images).
2. Add an upload control to `ProfilePage` (image picker → client-side resize/compress to a sane max dimension, e.g. 512px, before upload — keeps storage costs and load times low) → upload to the bucket → store the resulting URL in the existing `profiles.avatar_url` column (already present per the schema audit — likely unused today, which is a pleasant surprise that removes a migration step).
3. **"Update once a month" constraint**: track `avatar_updated_at` (new column, or reuse a pattern similar to the plan-regeneration cooldown already implemented in `PlanPage`) and surface remaining time until the next allowed update, mirroring the existing 30-day plan-regeneration UX so the pattern feels consistent across the app.
4. Replace initial-letter avatars with the uploaded image wherever they currently render (Profile header, Buddy cards, Buddy tiles on Dashboard) — falling back to initials when no image is set.

### Open questions to settle before building
- Moderation: is any check needed on uploaded images (even basic — file-type/size validation is a must; content moderation is likely overkill at this stage but worth a one-line policy decision)?
- Should the monthly cap apply to *removing* a photo too, or only to changing it? (Recommend: removal should always be allowed — the cap exists to prevent thrash/abuse of storage, not to trap users with an unwanted photo.)
