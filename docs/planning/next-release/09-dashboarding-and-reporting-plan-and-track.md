# Research & Design: Per-Modality Dashboarding & Reporting for Plan and Track Paths

Covers the new request: *"reporting of self-tracking and comprehensive dashboarding for selected plans; intuitive dashboarding/reporting for both plan and track paths with deeper navigation into the user's data; check all existing plan/track paths for where individual reporting can be made available; better line charts/graphs for tracked goals, exercises, cardio, yoga."*

This builds directly on **ticket #12 (Reporting, Dashboarding & Scoring)**, already scoped at a high level in `docs/planning/03-tracking-vitals-dashboards-profile.md` §4. That doc proposed a generalized `<MetricChart>` component and a "consistency score." This doc goes one level deeper: **what specifically should that reporting look like per modality, and for plan vs. track users**, given what's actually in the data model today.

---

## 1. Current state (what exists today)

`ProgressPage` (`src/pages/ProgressPage.tsx`) already provides, app-wide (not per-modality):
- A **weight trend** AreaChart (90 days, from `body_measurements`)
- A **weekly completion rate** BarChart (12-week rolling, % of all daily tasks completed)
- An **activity heatmap calendar** (per-day completion %, color-coded green/amber/red)
- A **historical date drill-down** (select any day → see that day's task check-ins and `daily_logs` comment fields)

This is a good *aggregate* view but treats all tasks/modalities as one undifferentiated pool. With the recently-shipped per-exercise (`exercise_logs`: sets, duration_minutes, source) and per-task (`task_logs`: value_logged, notes) structured logging, there is now enough underlying data to build **modality-specific reports** — but nothing currently surfaces it that way.

## 2. The core idea: a per-modality reporting tab/section

Rather than one monolithic Progress page, organize reporting around the user's **selected modalities** (`activity_modalities` from onboarding — gym, yoga, cardio, home, physio, diet, supplements, concerns), for *both* plan-path and track-only users:

- The Progress page gains a **modality switcher** (tabs or a horizontal pill selector) showing only the modalities the user actually selected — a user with gym + diet sees two tabs, not all eight.
- An **"Overview" tab** remains as the default — the existing app-wide charts (weight, completion %, heatmap) stay here, since they're cross-cutting.
- Each **modality tab** shows charts and summaries built from that modality's logged data, described per-modality below.

This directly answers "check all existing plan and track paths and where individual reporting can be made available" — the modality tabs are populated identically whether the underlying data came from an AI-generated plan task or a track-only `tracking_config` checklist item, since both write to the same `task_logs`/`exercise_logs` tables. No separate "track" reporting system is needed — same component, filtered by what the user actually logs.

## 3. Per-modality chart designs

### Gym / Home / Physio (reps_weight exercises)
- **Volume-over-time line chart**: total volume (Σ sets × reps × weight) per session, plotted over time — the single most requested "am I getting stronger" view in strength-training apps (see doc 11, Fitbod/JEFIT comparison in doc 01).
- **Per-exercise progression**: a drill-down — select an exercise name (e.g., "Barbell Squat") from a dropdown populated from the user's `exercise_logs` history → line chart of top-set weight or estimated 1RM over time. This is the natural reporting home for the **PR detection** feature already on the roadmap (Tier 2, `07-beta-priority-matrix.md`) — a PR is just a new maximum on this chart, and the chart is where the "New PR! 🎉" moment should be visually anchored.
- **Session frequency**: bar chart of workout sessions per week vs. the plan's prescribed frequency (planned vs. actual) — directly useful for physio users tracking rehab consistency.
- **Physio-specific**: since physio sessions are duration-based per `exercise_type`, the "volume" chart doesn't apply — instead show **total rehab minutes per week** vs. target, and a simple adherence streak.

### Yoga / Cardio (duration exercises)
- **Duration-over-time line chart**: minutes per session, with a 7-day rolling average overlay — mirrors the "Trends" pattern Apple Fitness uses (see doc 11) of smoothing noisy daily data into a readable trend line.
- **Session consistency**: same frequency bar chart as above (sessions/week vs. target).
- **Cardio-specific note**: the current `exercise_logs.notes` field for duration exercises is free text (e.g., "5km, felt strong") — distance/pace are not structured fields yet. A line chart of *distance* or *pace* requires extending the data model (flagged in the existing roadmap as "generalized logged-segment data shape extended across modalities" — Tier 2). Until then, duration is the only chartable metric for cardio; surface the free-text notes as a simple log list alongside the duration chart rather than attempting to parse them.
- **Yoga-specific note**: where a session is logged as multiple short holds rather than one block, aggregate total practice minutes per day before charting — avoids a noisy chart of many small per-pose entries.

### Diet
- Currently, diet adherence is captured only as free-text (`daily_logs.meal_comments`) or a generic "notes" task-log entry — there's no structured macro/calorie data to chart yet (this is explicitly **ticket N3 Phase 2**, deferred pending usage/cost-tracking infrastructure per the beta priority matrix).
- **What's chartable today without new infrastructure**: a simple **meal-logging consistency** view — a heatmap or bar chart of "days with a meal log entry" per week, analogous to the existing activity heatmap but scoped to diet tasks. This gives diet-path users *something* in their tab now, and becomes the natural home for macro/calorie trend charts once N3 ships.

### Supplements
- **Adherence streak/heatmap**: supplements are checkbox-style (`getTaskInputType` → `'none'`), so the most meaningful "chart" is a per-supplement adherence heatmap (rows = supplements, columns = days, cell = taken/missed) — a compact, information-dense view well-suited to a small number of recurring items.

### Concerns
- Not a logging modality (`isWorkoutModality: false`, no `describeForPrompt`-driven tasks beyond informational framing) — no dedicated chart. If the user has flagged a major medical concern (PCOS, thyroid, etc.), this tab can instead surface the AI plan's medical-disclaimer note as a persistent reminder, plus a link to relevant vitals if/when the vitals-logging work from doc `03-tracking-vitals-dashboards-profile.md` §2 ships (BP/blood sugar trend charts would belong here).

## 4. Navigation & "deeper drill-down" design

The request specifically asks for "more reporting and in depth navigation on reports for detailed look at the users data." Concretely:

1. **Progress page top level** = Overview (existing charts) + modality tabs (per §2).
2. **Within a modality tab**, summary charts are shown first (volume/duration trend, frequency).
3. **Tapping/clicking a chart or a specific exercise/task name** drills into a **detail view**: full history table for that exercise/task (date, value, notes), the existing date-picker historical view (already built — `selectedDate` + `dateTasks`/`dateLog` in `ProgressPage.tsx`) scoped to just that item, and range selection (week/month/90-day/all-time) reusing the `<MetricChart>` component proposed in doc 03.
4. **Range + chart-type switching** (line/bar/area, day/week/month) — as doc 03 already noted, Recharts supports this natively; this is a generalization of the existing `AreaChart`/`BarChart` usage into one reusable component with props for metric, range, and chart type, not a new charting library.

## 5. Implementation sequencing

This is naturally **Phase 2 of ticket #12**, sequenced after:
- The structured vitals/measurements work in doc `03-tracking-vitals-dashboards-profile.md` §2 (so vitals have somewhere to be charted under "Concerns"/health tab).
- No new database migrations are required for the **gym/home/physio/yoga/cardio/supplements** charts described above — they read from `exercise_logs` and `task_logs`, both already populated by the recently-shipped logging work.
- The **diet** and **cardio distance/pace** charts are explicitly gated on existing roadmap items (N3 macro extraction, and the "generalized logged-segment" data-model extension respectively) — build the tab shells now with a "coming soon, log more to unlock" empty state, and wire in the real charts once those land.

## 6. Relationship to the "consistency score" (ticket #15 / doc 03 §4.3)

The per-modality views above are a natural **input** to the consistency-score concept already proposed: a score that blends (a) % planned tasks completed, (b) whether structured data (sets/duration/vitals) was logged vs. just checked off, and (c) streak continuation. Recommend designing the score's per-modality breakdown *after* this dashboard ships — the dashboard surfaces the raw signals; the score is a derived summary of them, and building the score first risks summarizing data that isn't visualized anywhere yet.

---

## Sources
- Internal: `src/pages/ProgressPage.tsx` (current charts), `docs/planning/03-tracking-vitals-dashboards-profile.md` (ticket #12 prior design), `docs/planning/07-beta-priority-matrix.md` (N1-N7, PR detection, logged-segment generalization), `src/config/modalities/shared.ts` (8 modalities).
- [Fitbod: Best Workout Tracker Apps for 2026](https://fitbod.me/blog/best-workout-tracker-apps-for-2026/) — volume/progression charting as the core strength-app reporting pattern.
- [AppleMagazine: Apple Fitness Trends — Reading Long-Term Activity Insights](https://applemagazine.com/apple-fitness-trends/) — 90-day vs. 365-day rolling-trend comparison pattern referenced for the duration/volume trend charts above.

*Note: re-verify chart-library capabilities (Recharts) against final design specifics before implementation; this is planning/research, not build-ready specs.*
