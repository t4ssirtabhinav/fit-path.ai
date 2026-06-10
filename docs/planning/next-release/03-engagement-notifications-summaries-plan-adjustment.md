# Plan: Push Notifications, Weekly Summaries, Plan Regeneration & Auto-Adjustment

Covers tickets **#3 (push notifications), #4 (weekly summary in-app), #8 (plan regeneration for dissatisfied users), #10 (auto plan adjustment at phase transitions)**.

Note on overlap: ticket #8 here ("a way for users to adjust their plans if not satisfied") restates ticket **#17** from the previous roadmap (`docs/planning/05-content-ai-plans-personalization.md`) — and the codebase audit showed this *partially exists already* (regeneration with a 30-day cooldown). Ticket #4 here (in-app weekly summary) is the in-app counterpart to the **emailed** weekly summary already planned in `docs/planning/06-platform-error-logging-and-emails.md`. These cross-references are called out below so the two roadmaps stay consistent rather than drifting into duplicate designs.

---

## 1. Push Notifications (Ticket #3)

### Research: what 2026 best practice actually looks like
The clearest finding across multiple sources: **segment notifications into three tiers** — transactional (always send: security alerts, buddy-request received), behavioral-trigger (action/inaction-based: "you haven't logged today and it's 8pm"), and promotional (explicit opt-in only: "new feature," "weekly challenge"). This tiering is described as "the fastest structural fix for notification fatigue and uninstall rates." ([Reteno](https://reteno.com/blog/push-notification-best-practices-ultimate-guide-for-2026-2026), [vmobify](https://vmobify.com/blog/push-notification-strategy))

Other concrete findings:
- **Use a "push primer"** — an in-app screen explaining the specific value of notifications *before* triggering the native OS permission prompt. This "consistently lifts opt-in rates" — critically important on iOS, where the permission prompt can only be shown meaningfully once.
- **Re-engagement sequencing**: target lapsed users at **day 3, day 7, and day 14** of inactivity — a structured cadence "recovers a measurable cohort that would otherwise churn permanently."
- **Detect fatigue early** by watching 30/60/90-day trend lines, not just initial spikes — "a new campaign type might spike engagement initially due to novelty, then regress."

### Mapping FitPath's specific notification needs onto this framework

| Type | Tier | Examples | Notes |
|---|---|---|---|
| **Security/account** | Transactional (always on) | "Your password was changed," "new device sign-in" | From the prior roadmap's auth plan (doc 02) |
| **Daily task reminders** | Behavioral-trigger | "You have 3 tasks left for today" (sent only if incomplete by a configurable time) | Reuses `tracking_config.reminder_morning/evening` — currently captured but unused per the codebase audit; this is the natural first place to finally use them |
| **Pre-task nudges** | Behavioral-trigger | "Your evening workout starts in 30 minutes" | Requires task-level scheduling data — check whether the plan structure captures specific times, or only general timing categories |
| **Streak-risk alerts** | Behavioral-trigger | "Your 12-day streak is at risk — log something before midnight" | High-leverage, loss-aversion-based — pairs naturally with the existing streak system |
| **Buddy activity** | Behavioral-trigger, **opt-in granularity recommended** | "Alex just completed their checklist," "Alex sent you a buddy request" | Some users will want this, others will find it noisy — make it a togglable preference, not a blanket default |
| **Weekly summary ready** | Behavioral-trigger (scheduled) | "Your week in review is ready" | Links to the in-app summary (#4 below) and the emailed version from the prior roadmap |
| **Re-engagement** | Behavioral-trigger (lapsed-user sequence) | Day-3/7/14 messages, escalating from gentle to value-reminder | Should be **capped** — one message per stage, not a daily drumbeat |
| **Promotional/feature announcements** | Opt-in only | "New: menstrual cycle tracking is here" | Never default-on |

### Avoiding "notification fatigue" (the ticket's explicit concern)
- **One global notification-preferences screen** in Profile, with per-category toggles (not just a single on/off switch) — this is now table-stakes UX and directly prevents the most common complaint pattern.
- **Smart bundling**: if multiple notifications would fire close together (e.g. a task reminder and a buddy update), bundle into one "You have 2 updates" notification rather than two separate interruptions.
- **Quiet hours**: respect a user-configurable do-not-disturb window — this is a small feature with outsized goodwill impact.
- **Frequency caps per category** — e.g. no more than one streak-risk alert per day, no more than one re-engagement message per lapsed-period.

### Technical note (ties to the mobile roadmap, doc 02 of this folder)
True push notifications require native infrastructure — **APNs** (Apple Push Notification service) for iOS and **FCM** (Firebase Cloud Messaging) for Android — which only becomes available once the native app (React Native/Expo) exists. **Until then**, the achievable equivalent on the current web app is browser push (via service workers + the Web Push API) or simply in-app banners/badges + the email channel from the prior roadmap. Recommend treating *true* push as a feature that ships *with* the native app, and building the preference/segmentation architecture now so it's ready to wire up the moment native infrastructure exists.

---

## 2. Weekly Summary — In-App (Ticket #4)

### Relationship to the existing email plan
The prior roadmap (`docs/planning/06-platform-error-logging-and-emails.md`) already designed an **emailed** weekly summary. This ticket asks for the **in-app** counterpart — and the two should share a data-aggregation layer (one query/service producing the week's stats, rendered as both an email template and an in-app view) rather than being built as two separate features.

### What "last day's summary and gap filling" suggests
Re-reading the ticket's specific phrase — it seems to ask for something slightly different from (or in addition to) a weekly digest: a **daily catch-up view** that shows yesterday's results and *invites the user to fill gaps* (e.g. "You didn't log your evening vitals yesterday — want to add them now?"). This is a genuinely useful, distinct idea:
- **"Yesterday at a glance"** card on the dashboard each morning — tasks completed/missed, vitals logged/missing, streak status — with **inline quick-actions to backfill missing (non-immutable) data** for the previous day. This respects the "vitals can't be updated" rule from the prior roadmap (doc 03) by only offering backfill for the editable categories (notes, measurements not yet logged for that day), never for time-sensitive immutable vitals.
- **Weekly rollup** (the more conventional "weekly summary") — a richer view aggregating 7 days: completion trends, streak changes, milestones hit, comparison to the prior week. This is the natural in-app home for the Consistency Score concept from the prior roadmap's engagement plan (doc 04).

### Recommended placement
- "Yesterday at a glance" → a dismissible card at the top of the **Today/Dashboard** page (morning-only, auto-hides once interacted with or once the day progresses).
- "Weekly rollup" → a dedicated section on the **Progress** page (natural fit alongside the existing charts), refreshed every Monday (or on a user-chosen day).

---

## 3. Plan Regeneration for Dissatisfied Users (Ticket #8) — see prior roadmap doc 05

This restates ticket #17 from the previous roadmap nearly verbatim ("a way for them to adjust their plans... and validated with AI"). **Refer to `docs/planning/05-content-ai-plans-personalization.md` § 1** for the full plan — it already covers:
- Why free-form editing is risky for an AI-generated, safety-reviewed plan
- The recommended "structured change request → AI validates against full health profile → diff preview → accept/decline" flow
- Decoupling adjustment cooldowns from the existing 30-day full-regeneration cooldown
- Logging every adjustment request for audit/quality review

No new design is needed here — just confirming the same plan satisfies both ticket numbers, and flagging it so effort isn't duplicated.

---

## 4. Auto Plan Adjustment at Phase Transitions (Ticket #10)

This is a **new, distinct idea** from the previous roadmap's plan-adjustment ticket — it's proactive (the *system* notices something) rather than reactive (the *user* requests something).

### The proposed mechanic, restated
As a user logs consistent progress through their plan's current phase, the system should:
1. **Monitor progress against the plan** (completion rates, measurement trends, streak continuity — all data that already exists in `task_logs`, `body_measurements`, `streaks`).
2. **Proactively notify the user before their current phase ends** — "Your 8-week foundation phase wraps up in 5 days — let's plan what's next."
3. **Offer a choice of 2-3 candidate next-phase plans** generated based on updated goals + current progress + condition, letting the user "slowly move into a new plan" rather than experiencing an abrupt full reset.

### Why this is a strong idea worth prioritizing
This directly addresses one of the most common failure modes in fitness apps generally (and was implicitly visible in the competitive research — Noom's "repetitive after month one" complaint, the broader pattern of users plateauing and quitting at natural phase boundaries). A system that proactively re-engages users *at the exact moment they'd otherwise drift away* is a genuine retention lever — arguably higher-leverage than several of the other engagement ideas in this batch.

### Recommended design
1. **Phase-end detection**: the `plans` table already models `phase`, `phase_name`, `duration_months` — a scheduled check (similar to the weekly-summary aggregation job) can compute "days remaining in current phase" per user and trigger the notification flow at a sensible lead time (e.g. 5-7 days out).
2. **"Generate my next phase" flow**: rather than one AI call producing one plan, prompt the AI (with the user's full progress history — completion rates, measurement trends, any self-reported satisfaction signals) to produce **2-3 differentiated candidate next-phase plans** — e.g. "stay the course but increase intensity," "shift focus toward [a goal the user has been mentioning in personalization comments]," "maintain current plan with minor refinements." Show these as a simple comparison/selection UI, not a wall of text.
3. **Smooth transition, not a hard cutover**: the ticket's phrase "slowly move into a new plan" suggests a transition period where elements of the old and new phase coexist (e.g. the first week of a new phase eases in new exercises/targets rather than switching everything overnight) — this is a genuinely good UX instinct and worth preserving in the design; it also reduces the shock of "everything I knew about my routine just changed."
4. **Cost/quality note**: generating 2-3 candidate plans means 2-3x the AI cost of a single regeneration — budget for this, and consider generating only 1 plan upfront with "show me alternatives" as an on-demand secondary action, to keep the common-case cost down while still offering choice to users who want it.

### Sequencing
This is naturally **downstream of** the plan-adjustment work in ticket #8/#17 (same AI-prompting infrastructure, same safety-validation patterns) — recommend designing/building them together as one coherent "plan lifecycle" capability rather than two separate features bolted onto the `plans` table independently.
