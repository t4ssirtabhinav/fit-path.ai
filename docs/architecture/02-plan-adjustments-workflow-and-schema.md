# Plan Adjustments — End-to-End Workflow & Schema Design (no code yet)

A documentation-only design for the "self-service plan updates" feature (Ticket #17, referenced as `plan_adjustments` in [01-solid-oop-layered-architecture.md](01-solid-oop-layered-architecture.md) §6.2-6.4 and in [05-content-ai-plans-personalization.md](../planning/05-content-ai-plans-personalization.md) §1). It extends doc 01's sketch into a full functional workflow, with an explicit focus on **zero impact for users who never use it**, **schema design that absorbs unbounded combinations of adjustment types without growing**, and **reuse for coaching and B2B**.

Nothing here has been built. This is "plan only," per explicit instruction — Phase 3's implementable portion (`PlanService.getActivePlan`/`regeneratePlan`) is covered separately and has already shipped (see doc 01 §9, Phase 3).

---

## 1. Problem framing

Three requirements drove this design, all stated directly by the product owner:

1. **No leakage for users who don't adjust.** The vast majority of users will never click "Request a change." For them, the schema, the read path (`PlanService.getActivePlan` / `usePlan`), the RLS policies, and the UI must behave **exactly as today** — nothing new loaded, queried, or rendered unless they opt in.
2. **The schema must not become unwieldy.** Users can ask for almost anything — "make workouts shorter," "I'm now vegetarian," "swap my creatine for something else," "I broke up with my gym, give me home workouts," or several of these at once. A schema that tries to model each *type* of adjustment as its own column/table would grow without bound and become a maintenance burden.
3. **The same design must extend to coaching and B2B** — a coach editing a client's plan, or (later) a coach editing a reusable `plan_templates` row, should be able to reuse this workflow rather than getting a parallel one.

The design below resolves all three with one core decision: **an adjustment is always "a new full plan, validated the same way a freshly generated plan is."** The *request* can be about anything; the *result* is always a complete `PlanData` object that passes the same `PlanDataSchema` and the same safety constraints generation already enforces. This means the schema for *requests* never needs to enumerate adjustment types — it only needs to store free-form intent, the before/after snapshots, and a generic diff.

---

## 2. End-to-end functional workflow

### 2.1 Trigger

A new, **collapsed-by-default** "Request a change" section is added to `PlanPage.tsx`, below the existing "Regenerate plan" block (additive — no existing JSX changes, per doc 01 §6.5). It contains a single textarea ("What would you like to change about your plan?") and a submit button. A user who never expands this section sees nothing different from today.

### 2.2 Request → AI → validation → preview

```
User submits request_text
        │
        ▼
PlanService.requestAdjustment(userId, planId, requestText, requestedBy?)
        │
        ▼
adjust-plan edge function (new)
  input: { planId, requestText, currentPlanData, healthProfile, onboardingDetails }
  │
  ├─ AI prompt: "Here is the user's current plan, their full health profile,
  │   and their requested change. Produce an UPDATED FULL PLAN consistent
  │   with PlanDataSchema, preserving everything not relevant to the request.
  │   If the request conflicts with a safety constraint, explain what you
  │   adjusted instead and why."
  │
  ▼
AI returns a full proposed plan (same shape as generate-plan's output)
        │
        ▼
PlanDataSchema.safeParse(proposed)  ── whole-plan validation, same schema
        │                               generate-plan already uses
        ▼
PLAN_ADJUSTMENT_CONSTRAINTS.filter(c => !c.check(before, after))
        │
        ▼
diff_summary = computeDiff(before, after)   ── generic structural diff
        │
        ▼
plan_adjustments row created (status: 'pending' | 'constraint_violated')
        │
        ▼
Preview returned to PlanPage: diff_summary + violations (if any)
```

### 2.3 Accept / decline

- **Accept** (`PlanService.acceptAdjustment(adjustmentId)`): writes `after_snapshot` into `plans.plan_data` (the exact same write shape as `regeneratePlan` already performs — see `PlanRepository`/`PlanService` from Phase 3a), marks the row `status: 'accepted'`, sets `resolved_at`.
- **Decline** (`PlanService.declineAdjustment(adjustmentId)`): marks the row `status: 'declined'`, sets `resolved_at`. No write to `plans`.
- **Constraint-violated**: surfaced to the user as "Here's what we couldn't change and why" (the AI's own explanation, per the prompt instruction above) — the user can revise their request and resubmit. The row stays for audit (`status: 'constraint_violated'`).

### 2.4 Why "always a full plan" controls complexity

If the schema instead tried to represent *what kind* of change was requested (a `timeline_change` table, a `diet_swap` table, a `supplement_change` table...), every new adjustment idea would require a migration, and combined requests ("shorten my timeline AND make me vegetarian") would need cross-table coordination. By contrast:

- The **request** is always just `request_text` (free-form) + an optional coarse `adjustment_category` tag (used only for analytics/prompt-hinting, never for branching logic).
- The **result** is always a `PlanData` object — the same type the system already knows how to validate, render (`PlanPage`), and store (`plans.plan_data`).
- The **diff** is always computed generically by walking both objects — it doesn't need to know "this is a diet change" vs. "this is a timeline change" to produce a useful before/after summary.

This is the same principle that made the Phase 2 modality registry work: push variability into *data* (the AI's output, validated against one schema) rather than into *schema/code branches*.

---

## 3. Guardrails — zero leakage for non-adjusting users

| Concern | Guardrail |
|---|---|
| **New table touches existing tables** | `plan_adjustments` is purely additive (per doc 01 §6.4) — no new/changed columns on `plans`, `health_profiles`, or any other existing table. |
| **Read path changes for everyone** | `PlanService.getActivePlan` / `usePlan` (Phase 3a, already shipped) are untouched by this feature. Adjustments only ever reach `plans.plan_data` through `acceptAdjustment`'s explicit write — identical in shape and effect to today's `regeneratePlan` write. A user who never adjusts has a `plan_adjustments` table with zero rows and an unmodified `plans` row. |
| **UI surfaces something new for everyone** | The "Request a change" section is collapsed by default and entirely additive JSX. No existing section's markup, state, or behavior changes. |
| **Cooldown/cap interference with existing 30-day regen cooldown** | A **separate** cap — e.g. "≤3 pending or accepted adjustments per phase" — computed via a `plan_adjustments` count query (`status IN ('pending','accepted') AND plan_id = ... AND created_at >= phase_start`). This is intentionally decoupled from `plans.last_regenerated_at`; the two mechanisms must never read or write each other's state, so a user who has used adjustments has no different regen-cooldown behavior and vice versa. |
| **RLS** | `plan_adjustments`: `auth.uid() = user_id` (or `auth.uid() = requested_by` for the coach case, see §5) — same posture as `plans`. No existing RLS policy is modified. |
| **Data shape drift if `acceptAdjustment` writes something `parsePlanData` can't read** | `after_snapshot` is validated by `PlanDataSchema.safeParse` *before* it's ever written to `plans.plan_data` or stored as `after_snapshot` — so an accepted adjustment can never produce a `plan_data` value that fails `parsePlanData` on the next page load (the same invariant `regeneratePlan` already relies on). |

**Net effect:** for a user who never opens the "Request a change" section, the system is byte-for-byte identical to pre-Phase-3 behavior. For a user who opens it but never submits, one extra (empty) UI element renders — no queries, no rows.

---

## 4. Schema design

### 4.1 `plan_adjustments` table

Extends doc 01 §6.4 with the category tag and coaching/B2B columns from §5 below:

```sql
CREATE TABLE plan_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,

  -- request
  request_text text NOT NULL,
  adjustment_category text CHECK (adjustment_category IN
    ('timeline','diet','supplements','intensity','equipment','other')),

  -- result
  before_snapshot jsonb NOT NULL,
  after_snapshot jsonb,
  diff_summary jsonb,

  -- outcome
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','constraint_violated')),
  constraint_violations text[],

  -- coaching / B2B generalization (§5) — additive, nullable, unused for self-service
  requested_by uuid REFERENCES auth.users(id),
  adjustment_source text NOT NULL DEFAULT 'self'
    CHECK (adjustment_source IN ('self','coach','auto_phase_transition','b2b_template')),

  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX plan_adjustments_user_id_idx ON plan_adjustments(user_id);
CREATE INDEX plan_adjustments_plan_id_idx ON plan_adjustments(plan_id);

ALTER TABLE plan_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own adjustments"
  ON plan_adjustments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own adjustments"
  ON plan_adjustments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own adjustments"
  ON plan_adjustments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 4.2 Why each "complexity-absorbing" field is shaped the way it is

- **`adjustment_category`**: a coarse, fixed enum used only to (a) hint the AI prompt toward the relevant section of the plan and (b) power simple analytics ("what do users most often ask to change?"). It is **never** used to branch validation or storage logic — a request tagged `diet` that also happens to change the workout schedule is handled identically to one tagged `other`. New categories can be added to the `CHECK` constraint without touching any other part of the schema.
- **`before_snapshot` / `after_snapshot`**: full `PlanData` objects, validated by the existing `PlanDataSchema`. Whatever combination of fields changed — one field or twenty — is captured without any schema change, because the *shape* of a plan is already fully described by `PlanDataSchema`.
- **`diff_summary`**: computed by a generic deep-diff utility (`computeDiff(before, after): Record<string, { before: unknown; after: unknown }>` or similar — walks both objects, reports changed leaf paths). This is presentation data for the preview UI, not a validation input — so its shape can evolve freely without migrations.
- **`constraint_violations text[]`**: the actual extensibility point for "new kinds of safety rules." `PLAN_ADJUSTMENT_CONSTRAINTS` (doc 01 §6.3) is a plain array of `{ id, check(before, after), message }` objects — adding a new safety rule (e.g. "don't reduce protein below X g for users in a muscle-gain phase") is a one-entry addition to that array, with zero schema impact.

### 4.3 What this deliberately does *not* do

- No per-adjustment-type tables (`timeline_adjustments`, `diet_adjustments`, ...).
- No "patch"/JSON-merge-patch representation of the change — full snapshots are simpler to validate, diff, audit, and roll back, at the cost of some storage (acceptable: plan JSON is small, and rows are bounded by the per-phase cap in §3).
- No versioning table separate from `plans` — `plans.plan_data` is overwritten on accept (as it already is on regenerate), and `plan_adjustments.before_snapshot`/`after_snapshot` *is* the version history for adjustments specifically.

---

## 5. Coaching & B2B reuse

This section directly addresses the requirement that this design "overlap for coaching and b2b" without a separate schema.

### 5.1 Coach-initiated adjustments (B2B coaching)

- `requested_by` (nullable, defaults to `NULL`/`user_id` for self-service) and `adjustment_source` (`'self' | 'coach' | 'auto_phase_transition' | 'b2b_template'`) are already present in §4.1, unused (default `'self'`, `requested_by NULL`) for every self-service row.
- When Coach/Gym B2B (doc 01 §7) is built, `PlanService.requestAdjustment(userId, planId, requestText, requestedBy?)` — the exact generalization doc 01 §7.3 calls out — is called with `userId` = the **client's** id and `requestedBy` = the **coach's** id. The RLS policies above need exactly one additive `OR` branch (mirroring doc 01 §7.2's `is_coach_of()` pattern):
  ```sql
  USING (auth.uid() = user_id OR is_coach_of(user_id))
  ```
- The entire AI-validation/constraint/diff/accept-decline pipeline (§2) is unchanged — a coach's requested change is validated against the *client's* health profile and the *same* safety constraints, exactly like a self-service request. This is important: a coach cannot bypass the calorie-floor/rest-day/supplement-interaction constraints any more than the client can.

### 5.2 Auto plan-adjustment at phase transitions (Ticket #10)

- `adjustment_source = 'auto_phase_transition'` lets the proactive "your phase is ending, here's what's next" flow (next-release roadmap doc 03 §4) reuse this exact table and accept/decline UI, instead of inventing a parallel "phase transition proposals" table. The system (not a user) calls `requestAdjustment` with `adjustment_source: 'auto_phase_transition'` and a synthesized `request_text` (e.g. "Generate the next phase based on progress").

### 5.3 B2B plan templates (future, not designed in detail)

- `plan_templates.template_data` (doc 01 §7.1) is structurally a `PlanData`-shaped JSON blob (with placeholder markers, per doc 01 §7.4). The same `before/after_snapshot` + `diff_summary` + constraint-check pipeline *could* apply to template edits via a `target_type: 'plan' | 'template'` + `target_id` generalization of `plan_adjustments` (replacing the single `plan_id` FK with a polymorphic reference, or a sibling `template_adjustments` table reusing the same TS types/constraints).
- This is flagged as a **future extension point**, not specified further — designing it now would mean speculating about `plan_templates`' final shape before B2B is greenlit. The key forward-compatible decision made *now* is that `computeDiff`, `PLAN_ADJUSTMENT_CONSTRAINTS`, and the accept/decline state machine are written against `PlanData`-shaped objects generically, not against the `plans` table specifically — so they're reusable by construction whenever this is picked up.

---

## 6. Explicitly out of scope ("plan only")

Per doc 01 §10's "folded into Ticket #17's own implementation," none of the following are built as part of this design pass:

- `plan_adjustments` migration
- `adjust-plan` edge function
- `PlanService.requestAdjustment` / `acceptAdjustment` / `declineAdjustment`
- `PLAN_ADJUSTMENT_CONSTRAINTS` config and `computeDiff` utility
- The "Request a change" PlanPage section
- `is_coach_of()` RLS helper and the coach `OR` branch (depends on Coach/Gym B2B being greenlit, doc 01 §7)

These are deferred until Ticket #17 is scheduled for implementation — at that point, this document is the design to implement against.

---

## Critical files referenced

- `docs/architecture/01-solid-oop-layered-architecture.md` (§6.2-6.4, §7, §9 Phase 3)
- `docs/planning/05-content-ai-plans-personalization.md` (§1, Ticket #17)
- `docs/planning/next-release/03-engagement-notifications-summaries-plan-adjustment.md` (§3-4, Tickets #8/#10)
- `src/services/PlanService.ts`, `src/hooks/usePlan.ts`, `src/pages/PlanPage.tsx` (Phase 3a, shipped — the read/regenerate path this design builds on)
- `src/lib/planSchema.ts` (`PlanDataSchema`, `parsePlanData`)
- `supabase/migrations/20260604121806_create_fitpath_schema.sql` (`plans` table)
