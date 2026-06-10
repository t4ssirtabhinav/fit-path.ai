# SOLID/OOP Layered Architecture — Analysis & Design (no code yet)

A documentation-only architecture proposal, written after auditing the current codebase (June 2026). It covers: how the existing page-by-page structure can adopt a layered, SOLID-compliant design **incrementally and without breaking anything**; how that design solves the current onboarding/country/cuisine hardcoding and duplication; how it sets up the still-unbuilt "Plan" feature (including the self-service adjustments from [05-content-ai-plans-personalization.md](../planning/05-content-ai-plans-personalization.md)); a feasibility assessment for a **new, previously unplanned** Coach/Gym B2B layer; and what this means for the mobile roadmap in [next-release/02-mobile-apps-and-wearables.md](../planning/next-release/02-mobile-apps-and-wearables.md).

Nothing here has been built. No existing functionality, routes, guards, styling, or dependencies are proposed to change.

---

## 1. Executive Summary

**Current state.** FitPath.ai is a Vite + React 18 + TypeScript + Supabase app with no service or data-access layer: every page (`OnboardingPage.tsx`, `DashboardPage.tsx`, `PlanPage.tsx`, `ProfilePage.tsx`, `BuddyPage.tsx`, `JoinBuddyPage.tsx`, `GeneratePlanPage.tsx`) calls `supabase.from(...)` / `supabase.rpc(...)` directly, inline with UI logic and derivation logic. `OnboardingPage.tsx` alone is ~1,900 lines containing 13 step components, large hardcoded constant blocks (countries, cuisines, currencies, modality metadata), and the only domain-derivation functions in the app (`derivedActivityLevel`, `derivedFitnessGoals`, etc.).

**The core problem.** A "modality" (gym, yoga, cardio, home, physio, diet, supplements, concerns) is currently defined in **three places that must be hand-kept-in-sync**: the frontend selector (`GOAL_MODALITIES`), the frontend per-modality step component (`StepGoalGym`, etc., each with its own inline option lists), and the backend AI prompt builder (`MODALITY_LABELS`, `describeModality()`, `WORKOUT_MODALITIES` in `supabase/functions/generate-plan/index.ts`). Country/cuisine/currency data has a similar single-location problem (frontend-only, backend has zero awareness). The plan-data Zod schema is duplicated between `src/lib/planSchema.ts` and the edge function.

**Why this matters now, not just "eventually."** The next three workstreams already on the roadmap — self-service plan adjustments (Ticket #17), the quick-read content library (Ticket #18, which needs to tag content against `activity_modalities`), and the **new** Coach/Gym B2B requirement from this session — all need the *same* underlying capability: **a single, canonical definition of what a modality/profile field means, consumable by both UI and AI prompts.** Building any of these on the current triplicated structure means quadrupling the duplication or doing the refactor later, under pressure, underneath shipped features.

**Proposed direction.** A 4-layer architecture (Domain/Config → Data Access → Service/Business → Presentation), introduced via a **5-phase, fully incremental migration** where Phase 0 is a same-day, zero-risk extraction and every subsequent phase is independently shippable and can be paused indefinitely. The centerpiece is a **Modality Registry** (Section 4) that collapses the three-way modality duplication into one file per modality, consumed by both the onboarding wizard and the `generate-plan` edge function.

**Headline recommendation (Section 10):** refactor incrementally, starting now. Phase 0 today; Phase 1 (repositories) opportunistically as pages are touched; Phase 2 (modality registry) as a dedicated 3–5 day effort *before* starting the content library or coach/gym work, since both depend on it; Phase 3 (Plan service + adjustments) folded into Ticket #17's own implementation; Phase 5 demand-driven.

---

## 2. Current Architecture Assessment

### 2.1 Inventory

| Area | Files | Notes |
|---|---|---|
| **Pages** | `src/pages/OnboardingPage.tsx` (1,887 lines), `DashboardPage.tsx` (644), `PlanPage.tsx` (387), `ProgressPage.tsx` (299), `ProfilePage.tsx` (252), `BuddyPage.tsx` (399), `GeneratePlanPage.tsx` (150), `LoginPage.tsx` (143), `RegisterPage.tsx` (204), `JoinBuddyPage.tsx` (111) | All query Supabase directly |
| **UI components** | `src/components/ui/{Button,Card,Input}.tsx`, `src/components/layout/AppLayout.tsx`, `src/components/ErrorBoundary.tsx` | Generic, reusable, kept as-is |
| **State** | `src/contexts/AuthContext.tsx` | Only context: `user`, `session`, `profile`, `signOut`, `refreshProfile`. No other contexts, no Redux/Zustand/TanStack Query |
| **Lib** | `src/lib/supabase.ts` (client singleton), `src/lib/planSchema.ts` (Zod schema for `plan_data` + `parsePlanData()`), `src/lib/utils.ts` (`cn()`, date/timezone helpers, BMI) | |
| **Types** | `src/types/index.ts` (domain types: `OnboardingData`, `GoalModality`, `GoalDetails`, `PlanData`, etc.), `src/types/database.ts` (Supabase-generated Row/Insert/Update) | |
| **Edge functions** | `supabase/functions/generate-plan/index.ts` (642 lines) — `buildPrompt()`, `describeModality()`, `derivePhasePlan()`, `buildNutritionRules()`, `buildSupplementGuidance()`, its own Zod schema, Gemini 3 Flash call | No `_shared/` module exists |
| **Routing** | `src/App.tsx` — `RequireAuth`, `RequireOnboarding` guards; routes for `/login`, `/register`, `/join/:code`, `/onboarding`, `/generate-plan`, `/dashboard`, `/plan`, `/progress`, `/buddy`, `/profile` | Untouched by this proposal |
| **Dependencies** | React 18.3, react-router-dom 6.30, `@supabase/supabase-js` 2.57, zod 4.4, recharts, date-fns, lucide-react, Tailwind | No new dependencies proposed |

### 2.2 Duplication & hardcoding inventory

| Issue | Where | Risk |
|---|---|---|
| **Modality definitions** triplicated | `OnboardingPage.tsx`: `GOAL_MODALITIES` (8, with icon/label/description), `MODALITY_ORDER`, 8 bespoke `StepGoal*` components with inline option arrays, each with its own `GymDetails`/`YogaDetails`/etc. type. `generate-plan/index.ts`: separate `MODALITY_LABELS` (different wording), `WORKOUT_MODALITIES` set, `describeModality()` re-encoding the same per-modality semantics. | Drift already exists between frontend labels and backend labels; adding/changing a modality requires edits in 3+ places |
| **Country/cuisine/currency constants** | `OnboardingPage.tsx`: `COUNTRIES` (30), `SOUTH_ASIA_COUNTRIES`/`MIDDLE_EAST_COUNTRIES`/`SOUTHEAST_ASIA_COUNTRIES`, `COMMON_CUISINE_OPTIONS`, `getCuisineOptions()`, `CURRENCY_INFO` (26), `getSupplementBudgetOptions()`, `DEFAULT_CURRENCY` | Backend has zero knowledge of cuisine/currency groupings — receives only free-text `country`/`cuisine_style[]`. Adding a country/region requires new `if`-branches |
| **Plan schema** duplicated | `src/lib/planSchema.ts` (`PlanDataSchema`, `parsePlanData`) vs. `generate-plan/index.ts`'s own copy, with subtle differences already (`z.number()` vs `z.coerce.number()`) | Two sources of truth for the plan-data contract |
| **Domain/derivation logic embedded in a page** | `derivedBodyType`, `derivedActivityLevel`, `derivedFitnessGoals`, `derivedCommitmentDays`, `sanitizeComment`, `buildStepSequence`, `validateStep` all live as module-level functions inside `OnboardingPage.tsx` | Untestable in isolation, unusable from a future coach-driven onboarding flow |
| **PlanPage is read-only** | `src/pages/PlanPage.tsx` | Displays `plan_data` (parsed via `parsePlanData`), one mutation (`regenerate()`, 30-day cooldown). No editing, no adjustment workflow, no phase-progression UI — this is "the plan part of the app not built yet" referenced by the user |
| **No `_shared/` module** | `supabase/functions/` | Deno edge functions can't `import` from `node_modules`-resolved `src/` paths the way Vite does — this is the central constraint for any frontend/backend code sharing (addressed in Section 4.2) |

---

## 3. Proposed Layered Architecture (HLD)

### 3.1 Layers and dependency direction

Four layers, strict one-directional dependency — each layer may import only from itself or layers below:

```
┌─────────────────────────────────────────────────────────────┐
│ Presentation        pages/, components/, hooks/               │  React, Tailwind, routing
├─────────────────────────────────────────────────────────────┤
│ Service / Business  services/ (PlanService, OnboardingService, │  Plain TS classes/objects.
│                      ModalityRegistryService, derivations)     │  No React, no Supabase types leak
├─────────────────────────────────────────────────────────────┤
│ Data Access         repositories/ (HealthProfileRepository,    │  Only layer that imports
│                      PlanRepository, ProfileRepository, ...)   │  lib/supabase
├─────────────────────────────────────────────────────────────┤
│ Domain / Config     types/, config/ (constants, modality        │  Pure data + types,
│                      registry, country data, plan schema)       │  zero dependencies.
└─────────────────────────────────────────────────────────────┘  Shared with edge functions.
```

- **Domain/Config**: pure types, constants, Zod schemas. No imports from other app layers. This is the layer shared with `supabase/functions/_shared/`.
- **Data Access (repositories)**: the *only* place `supabase.from()`/`supabase.rpc()` appears outside `AuthContext` (auth stays as-is — it's already a thin wrapper). Repositories return domain types, aliased from `types/index.ts`; no need for parallel DTOs in simple 1:1 cases.
- **Service/Business**: derivation functions, `ModalityRegistry`, `PlanService`, `OnboardingService`. Depends on repositories and domain types — never on React or `supabase` directly.
- **Presentation**: hooks (`useHealthProfile`, `usePlan`, ...) + pages/components. After migration, components never call `supabase.from()` directly.

Enforceable incrementally: an opt-in ESLint `no-restricted-imports` rule can flag new `supabase.from()` calls outside `repositories/` once a domain has migrated — not a blocking rule from day one.

### 3.2 SOLID mapping

| Principle | How it's applied |
|---|---|
| **SRP** | One repository per table/aggregate (`HealthProfileRepository`, `PlanRepository`, `ProfileRepository`, `TrackingConfigRepository`, `BuddyRepository`, `DailyTaskRepository`, `StreakRepository`, `BodyMeasurementRepository`). One service per bounded capability (`OnboardingService` orchestrates onboarding save/derivation; `PlanService` owns plan lifecycle/adjustments; `ModalityRegistry` owns modality metadata/schema/prompt-fragment lookup). |
| **OCP** | A new modality (e.g. "swimming") = one new `ModalityDefinition` file + one registry entry — zero edits to `OnboardingPage.tsx` or the edge function. A new country = one config object — zero new `if` branches. |
| **LSP** | All `ModalityDefinition<T>` implementations conform to one interface. Repositories aren't forced into an over-engineered generic `Repository<T>` — most expose specific named methods, since Supabase queries aren't generic CRUD; consistency comes from naming conventions, not inheritance. |
| **ISP** | Hooks expose narrow interfaces — `useHealthProfile()` doesn't force a consumer to know about `tracking_config` or `plans`. |
| **DIP** | Services depend on the *type* of a repository object (effectively an interface), not on `lib/supabase` directly — enables mocking in tests and, longer-term, swapping the underlying client (relevant for React Native, Section 8). |

### 3.3 Proposed folder structure

```
src/
  components/
    ui/                       # unchanged: Button, Card, Input
    layout/                   # unchanged: AppLayout
    onboarding/               # NEW — extracted shared onboarding UI primitives
      ProgressBar.tsx, StepHeader.tsx, FieldLabel.tsx,
      MultiSelectChips.tsx, RadioCards.tsx, ButtonGrid.tsx,
      StressPicker.tsx, TagInput.tsx
      StepGoalModality.tsx     # NEW — generic, registry-driven step component
  config/
    modalities/
      types.ts                # ModalityDefinition interface
      registry.ts             # MODALITY_REGISTRY, MODALITY_ORDER
      gym.ts, yoga.ts, cardio.ts, home.ts, physio.ts,
      diet.ts, supplements.ts, concerns.ts
    countries/
      types.ts, countries.ts, cuisines.ts, currencies.ts, timezone-detect.ts
    trackers.ts                # TRACKERS constant (extracted, simple)
    planConstraints.ts          # Ticket #17 safety constraints
  contexts/
    AuthContext.tsx             # unchanged
  hooks/
    useHealthProfile.ts, usePlan.ts, useOnboarding.ts,
    useTrackingConfig.ts, useDailyTasks.ts, useStreak.ts, useBuddies.ts
  lib/
    supabase.ts                 # unchanged
    planSchema.ts                # unchanged location; canonical source, mirrored into _shared/
    utils.ts                     # unchanged
  repositories/
    HealthProfileRepository.ts, ProfileRepository.ts, PlanRepository.ts,
    PlanAdjustmentRepository.ts, TrackingConfigRepository.ts,
    DailyTaskRepository.ts, StreakRepository.ts, BuddyRepository.ts,
    BodyMeasurementRepository.ts
  services/
    OnboardingService.ts         # derivation functions + saveDraft orchestration
    PlanService.ts
  pages/                          # unchanged file list, slimmed down over time
  types/
    index.ts, database.ts

supabase/
  functions/
    _shared/                      # NEW
      modalities/                 # mirrors src/config/modalities (relative import or sync script)
      planSchema.ts                # mirrors src/lib/planSchema.ts
      planConstraints.ts            # mirrors src/config/planConstraints.ts
    generate-plan/index.ts          # imports from _shared/ instead of inline duplicates
    adjust-plan/index.ts            # NEW — Ticket #17 edge function
```

---

## 4. Modality Questionnaire Registry (LLD)

### 4.1 The `ModalityDefinition` interface

One interface captures everything currently scattered across the frontend selector, the per-modality step component, and the backend prompt builder:

```typescript
// src/config/modalities/types.ts (domain layer — zero deps besides zod)
export interface ModalityFieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface ModalityFieldContext {
  country?: string;   // needed for diet's getCuisineOptions(country)
  age?: number;
  gender?: string;
}

export interface ModalityFieldDef<TDetails> {
  key: keyof TDetails & string;
  kind: 'radio' | 'multiselect' | 'buttongrid' | 'tags' | 'stresspicker';
  label: string;
  // options can depend on in-progress answers (e.g. gym days/week options
  // change based on selected experience level) and on context (e.g. country)
  options?: ModalityFieldOption[]
    | ((details: Partial<TDetails>, ctx: ModalityFieldContext) => ModalityFieldOption[]);
  max?: number; // for multiselect
}

export interface ModalityDefinition<TDetails = Record<string, unknown>> {
  id: GoalModality;
  label: string;
  description: string;
  icon: string;
  isWorkoutModality: boolean;       // replaces WORKOUT_MODALITIES set
  schema: z.ZodType<TDetails>;       // validates onboarding_details[modality]
  uiFields: ModalityFieldDef<TDetails>[];  // declarative form definition
  stepHeader: { title: string; subtitle: string };
  describeForPrompt(details: Partial<TDetails>, ctx: { country?: string }): string; // == describeModality()
}
```

### 4.2 Cross-runtime sharing (the central constraint)

Vite (npm-resolved) and Deno edge functions can't share a `node_modules` package directly, but Deno can resolve relative `.ts` paths and can import `npm:zod@4` — the same major version already used by the frontend, so schemas are structurally compatible.

**Recommended approach (try first):** `supabase/functions/generate-plan/index.ts` imports the registry via a relative path, e.g. `import { MODALITY_REGISTRY } from "../../../src/config/modalities/registry.ts"`. Validate this with a no-op change first (Phase 2, see Section 9) — import just `MODALITY_ORDER` and log it, confirm `supabase functions deploy` bundles it correctly, *before* wiring `describeModality`.

**Fallback if the bundler can't resolve paths outside `supabase/`:** a small sync script (e.g. `scripts/sync-shared.ts`, run as part of `predeploy`) copies `src/config/modalities/` and `src/lib/planSchema.ts` into `supabase/functions/_shared/` verbatim. The copy is generated, never hand-edited; CI can fail on a stale-copy `diff` check. This preserves "single source of truth" within current tooling even if direct relative imports don't work.

### 4.3 Worked example: `gym.ts`

```typescript
// src/config/modalities/gym.ts
import { z } from 'zod';
import type { ModalityDefinition } from './types';
import type { GymDetails } from '../../types';

const GymDetailsSchema = z.object({
  experience: z.string(),
  equipment: z.string(),
  days_per_week: z.number(),
  primary_focus: z.array(z.string()),
});

export const GymModality: ModalityDefinition<GymDetails> = {
  id: 'gym',
  label: 'Gym Workout',
  description: 'Structured training with weights and machines',
  icon: '🏋️',
  isWorkoutModality: true,
  schema: GymDetailsSchema,
  stepHeader: {
    title: 'Gym Workout',
    subtitle: 'This shapes your split, load progression, and weekly structure.',
  },
  uiFields: [
    {
      key: 'experience', kind: 'radio', label: 'How long have you been training consistently?',
      options: [
        { value: 'never', label: 'Never started' },
        { value: 'beginner', label: '< 3 months — Beginner' },
        { value: 'intermediate', label: '3–12 months — Intermediate' },
        { value: 'advanced', label: '1–3 years — Advanced' },
        { value: 'experienced', label: '3+ years — Experienced' },
      ],
    },
    {
      key: 'equipment', kind: 'radio', label: 'Equipment access',
      options: [
        { value: 'full_gym', label: 'Full gym membership' },
        { value: 'home_gym', label: 'Home gym (dumbbells, rack)' },
        { value: 'minimal', label: 'Minimal (bands, dumbbells only)' },
        { value: 'bodyweight', label: 'Bodyweight only' },
      ],
    },
    {
      key: 'days_per_week', kind: 'buttongrid', label: 'Training days per week',
      // mirrors today's StepGoalGym: fewer options offered to beginners
      options: (details) => {
        const max = ['never', 'beginner'].includes(String(details.experience)) ? 4 : 6;
        return Array.from({ length: max - 1 }, (_, i) => ({ value: String(i + 2), label: `${i + 2}` }));
      },
    },
    {
      key: 'primary_focus', kind: 'multiselect', label: 'Primary focus — pick up to 3', max: 3,
      options: [
        { value: 'build_muscle', label: 'Build muscle' },
        { value: 'lose_fat', label: 'Lose fat' },
        { value: 'improve_strength', label: 'Get stronger' },
        { value: 'improve_endurance', label: 'Endurance' },
        { value: 'improve_flexibility', label: 'Flexibility' },
        { value: 'tone_body', label: 'Tone & define' },
        { value: 'prepare_long_term', label: 'General fitness' },
      ],
    },
  ],
  describeForPrompt(d) {
    const safeList = (v?: string[]) => (v?.length ? v.join(', ') : 'none');
    return `Gym/strength training — experience: ${d.experience ?? 'unspecified'}, equipment access: ${d.equipment ?? 'unspecified'}, ${d.days_per_week ?? '?'} sessions/week, focus areas: ${safeList(d.primary_focus)}`;
  },
};
```

```typescript
// src/config/modalities/registry.ts
export const MODALITY_ORDER: GoalModality[] =
  ['gym', 'yoga', 'cardio', 'home', 'physio', 'diet', 'supplements', 'concerns'];

export const MODALITY_REGISTRY: Record<GoalModality, ModalityDefinition<any>> = {
  gym: GymModality, yoga: YogaModality, cardio: CardioModality, home: HomeModality,
  physio: PhysioModality, diet: DietModality, supplements: SupplementsModality, concerns: ConcernsModality,
};
```

**Frontend consumption:**
- `GOAL_MODALITIES` (the selector) becomes `Object.values(MODALITY_REGISTRY).map(m => ({ id: m.id, label: m.label, description: m.description, icon: m.icon }))`.
- The 8 bespoke `StepGoal*` components collapse into **one generic `StepGoalModality`** that reads `MODALITY_REGISTRY[modalityId].uiFields` and renders the matching existing UI primitive (`RadioCards`, `MultiSelectChips`, `ButtonGrid`, `TagInput`, `StressPicker` — these components themselves are unchanged, just config-driven instead of hand-written per step).
- `validateStep()` reads `uiFields` to know which fields are required, instead of a hardcoded per-step check list.

**Backend consumption (`generate-plan/index.ts`):**
```typescript
import { MODALITY_REGISTRY } from "../_shared/modalities/registry.ts";

// describeModality(modality, details) becomes:
const description = MODALITY_REGISTRY[modality].describeForPrompt(details, { country });

// WORKOUT_MODALITIES becomes:
const workoutModalityIds = new Set(
  Object.values(MODALITY_REGISTRY).filter(m => m.isWorkoutModality).map(m => m.id)
);
```

> **Note:** migrating `describeModality`/`MODALITY_LABELS` to the registry will change the *exact wording* the AI sees (today's two label sets already differ slightly). This is prompt text, not user-facing copy, but Section 9 (Phase 2) calls for smoke-testing plan generation across modality combinations after this change.

### 4.4 What this collapses

| Before (3 locations) | After (1 location) |
|---|---|
| `GOAL_MODALITIES`, `MODALITY_ORDER` (frontend selector) | `MODALITY_REGISTRY`, `MODALITY_ORDER` (config) |
| 8× `StepGoalXxx` components with inline options | 1× `StepGoalModality` + `MODALITY_REGISTRY[id].uiFields` |
| `MODALITY_LABELS`, `WORKOUT_MODALITIES`, `describeModality()` (backend) | `MODALITY_REGISTRY[id].label` / `.isWorkoutModality` / `.describeForPrompt()` |

Adding a 9th modality ("swimming") = one new file (`src/config/modalities/swimming.ts`) + one registry entry. Zero changes to `OnboardingPage.tsx`, `generate-plan/index.ts`, or any step component.

---

## 5. Country / Cuisine / Currency Config (LLD)

Same philosophy — extract to `src/config/countries/`, pure data:

```typescript
// src/config/countries/types.ts
export interface CountryConfig {
  name: string;                 // 'India'
  region: 'south_asia' | 'middle_east' | 'southeast_asia' | 'other';
  currency: { symbol: string; supplementBudgetTiers: [number, number, number] };
  timezonePatterns?: RegExp[];  // for detectCountry()
}
```

```
src/config/countries/
  types.ts
  countries.ts      # COUNTRIES: CountryConfig[] — replaces the flat COUNTRIES array
  cuisines.ts        # cuisine groupings + getCuisineOptions(country), reading CountryConfig.region
  currencies.ts      # getSupplementBudgetOptions(country), reading CountryConfig.currency
  timezone-detect.ts # detectCountry()/detectTimezone()
```

This collapses `COUNTRIES`, `SOUTH_ASIA_COUNTRIES`/`MIDDLE_EAST_COUNTRIES`/`SOUTHEAST_ASIA_COUNTRIES`, `CURRENCY_INFO`, `DEFAULT_CURRENCY`, and the `detectCountry()` if/else chain into **one array of `CountryConfig` objects**, each with a `region` field driving `getCuisineOptions()` (a `Record<region, CuisineOption[]>` lookup merged with `COMMON_CUISINE_OPTIONS`) and a `currency` field driving `getSupplementBudgetOptions()`.

**Extension point:** a new country = one object literal (`name`, `region`, `currency`). A genuinely new region = one new enum value + one new `cuisines.ts` entry.

**File-based vs. DB-backed:** recommend **file-based** (versioned TS const data, type-checked, zero runtime fetch) for now — appropriate for the current team size and editing cadence. Revisit only if (a) non-engineers need to edit this without a deploy, or (b) Coach/Gym B2B (Section 7) needs per-tenant currency overrides — at that point `src/config/countries/` becomes seed/fallback data, and a `CountryConfigRepository` can layer DB overrides on top of the *same* `CountryConfig` shape, so consuming code doesn't change.

---

## 6. Plan Feature Architecture (HLD + LLD)

### 6.1 Current state

`PlanPage.tsx` directly queries `plans`, parses `plan_data` via `parsePlanData()`, and has exactly one mutation: `regenerate()` (calls the edge function, 30-day cooldown). No editing, adjustment, or phase-progression UI exists — this is the "plan part of the app not built yet."

### 6.2 `PlanService`

```typescript
// src/services/PlanService.ts
export class PlanService {
  constructor(
    private planRepo = PlanRepository,
    private adjustmentRepo = PlanAdjustmentRepository, // new, Ticket #17
  ) {}

  async getActivePlan(userId: string) {
    const row = await this.planRepo.getActive(userId);
    if (!row) return null;
    const data = parsePlanData(row.plan_data);
    return data ? { plan: row, data } : null;
  }

  async regeneratePlan(userId: string) { /* wraps existing edge-function call */ }

  // --- Ticket #17: constrained adjustment workflow ---
  async requestAdjustment(userId: string, planId: string, requestText: string): Promise<AdjustmentPreview> {
    const current = await this.planRepo.getById(planId);
    const before = parsePlanData(current.plan_data);

    const after = await this.callAdjustPlanFunction(planId, requestText); // new `adjust-plan` edge fn
    const validated = PlanDataSchema.parse(after); // whole-plan shape validation

    const violations = PLAN_ADJUSTMENT_CONSTRAINTS
      .filter(c => !c.check(before, validated))
      .map(c => c.message);

    const adjustment = await this.adjustmentRepo.create({
      user_id: userId, plan_id: planId, request_text: requestText,
      before_snapshot: before, after_snapshot: validated,
      diff_summary: computeDiff(before, validated),
      status: violations.length ? 'constraint_violated' : 'pending',
      constraint_violations: violations,
    });

    return { adjustmentId: adjustment.id, before, after: validated, diffSummary: adjustment.diff_summary, violations };
  }

  async acceptAdjustment(userId: string, adjustmentId: string): Promise<PlanData> {
    const adj = await this.adjustmentRepo.getById(adjustmentId);
    await this.planRepo.updatePlanData(adj.plan_id, adj.after_snapshot);
    await this.adjustmentRepo.markResolved(adjustmentId, 'accepted');
    return adj.after_snapshot as PlanData;
  }

  async declineAdjustment(adjustmentId: string) {
    await this.adjustmentRepo.markResolved(adjustmentId, 'declined');
  }

  async getPhaseProgress(userId: string) { /* days into phase X of Y, transition due? */ }
  async advanceToNextPhase(userId: string) { /* targeted regen via { mode: 'next_phase', currentPlan } */ }
}
```

### 6.3 Non-adjustable safety constraints (Ticket #17)

```typescript
// src/config/planConstraints.ts (domain layer, shared via _shared/ like the modality registry)
export const PLAN_ADJUSTMENT_CONSTRAINTS: PlanConstraint[] = [
  { id: 'min_rest_days', check: (before, after) => countRestDays(after) >= 1,
    message: 'Plan must include at least one rest day per week.' },
  { id: 'calorie_floor', check: (before, after) => after.calorie_target >= MIN_SAFE_CALORIES,
    message: 'Calorie target cannot go below a safe minimum.' },
  { id: 'supplement_interaction', check: (before, after) => !hasKnownInteraction(after.supplements),
    message: 'Requested supplement combination has a known interaction.' },
  // extension point: add new PlanConstraint objects here
];
```

`requestAdjustment` runs these checks on the AI-proposed plan **before** returning a preview — any failure rejects the adjustment outright (or, as an implementation-time choice, triggers a follow-up AI prompt naming the violated constraint). Because the constraint-checking function lives in domain config, both `PlanService` (frontend) and the `adjust-plan` edge function (server-side defense-in-depth) can import it via the same `_shared/` mechanism as the modality registry.

### 6.4 New table: `plan_adjustments`

```sql
CREATE TABLE plan_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  request_text text NOT NULL,
  before_snapshot jsonb NOT NULL,
  after_snapshot jsonb,
  diff_summary jsonb,
  status text NOT NULL CHECK (status IN ('pending','accepted','declined','constraint_violated')),
  constraint_violations text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
```

Purely additive — no existing table changes.

### 6.5 `usePlan` hook and `PlanPage.tsx`

```typescript
// src/hooks/usePlan.ts
export function usePlan() {
  const { user } = useAuth();
  // wraps PlanService: { plan, planData, loading, error,
  //   regenerate, requestAdjustment, acceptAdjustment, declineAdjustment, refresh }
}
```

`PlanPage.tsx` becomes purely presentational: render `planData` from `usePlan()` (existing sections unchanged), and add a new "Request a change" section (textarea → `requestAdjustment` → diff preview → accept/decline buttons). Entirely additive — no existing JSX changes.

---

## 7. Coach/Gym B2B Feasibility Assessment

This requirement is **new** — it appears in no existing planning doc. Below is its scope, its impact on the schema/RLS, and how the proposed layering either accommodates or blocks it.

### 7.1 New entities

| Table | Purpose | Key columns |
|---|---|---|
| `organizations` | A gym/coach business | `id, name, owner_user_id, plan_tier, created_at` |
| `organization_members` | Links a `profiles.id` to an org with a role | `org_id, user_id, role ('owner'\|'coach'\|'client')` |
| `coach_clients` | Coach ↔ client relationship | `coach_id, client_id, status, created_at` |
| `plan_templates` | Coach-authored reusable plan skeletons | `org_id, coach_id, name, template_data jsonb, created_at` |
| `plans` (extended) | Existing table, **additive nullable columns** | `+ created_by uuid`, `+ template_id uuid REFERENCES plan_templates(id)`, `+ assigned_by_coach boolean DEFAULT false` |

For existing rows, `created_by = user_id` and `assigned_by_coach = false` — **fully backward compatible, zero behavior change for self-service users**.

A coach relationship is asymmetric (coach can edit a client's plan; a buddy cannot edit a buddy's plan) — recommend a **new `coach_clients` table** rather than overloading the existing `buddies` table, to avoid role-conditional logic creeping into RLS policies designed for symmetric peer relationships.

### 7.2 RLS implications

Current RLS on `plans`, `health_profiles`, `daily_tasks`, etc. is strict `auth.uid() = user_id`. The new requirement: a coach needs `SELECT` (and possibly `INSERT`/`UPDATE` on `plans`) for their active clients.

**Proposed pattern — additive only:**
```sql
-- new SECURITY DEFINER helper, same pattern as the existing lookup_profile_by_invite_code RPC
CREATE FUNCTION is_coach_of(client_id uuid) RETURNS boolean ...

-- existing policy gains an OR branch; nothing removed
USING (auth.uid() = user_id OR is_coach_of(user_id))
```

This is additive (`OR` branch) — existing self-access policies remain untouched, so non-coach users see no change.

**Multi-tenancy model:** shared schema, row-level isolation via `coach_clients`/`org_id` — not separate schemas/databases per tenant. Appropriate at current scale; revisit only if a single org's volume or compliance needs (e.g. data residency) demand isolation.

### 7.3 Why the proposed layering is "B2B-ready at the seams"

- **Repositories take `userId` explicitly, never read `useAuth()` internally.** This is the single design rule (established in Phase 1, Section 9) that makes coach access "just work" once RLS permits it: `HealthProfileRepository.getForUser(userId)` and `PlanService.getActivePlan(userId)` work identically whether `userId` is "me" or "my client."
- **`MODALITY_REGISTRY` and `OnboardingService` are directly reusable for "coach builds a plan template."** A coach-facing template builder reuses the *same* `StepGoalModality` component and registry-driven forms, writing to `plan_templates.template_data` instead of `health_profiles`. This is a strong reason to do the modality registry work (Section 4) regardless of B2B — it pays for itself twice.
- **`PlanService.requestAdjustment`** generalizes to coach-initiated edits with one additional nullable column (`plan_adjustments.requested_by`) and `requestAdjustment(userId, planId, request, requestedBy?)`.

### 7.4 What's genuinely net-new (not solved by layering alone)

- **Org-level dashboards** (coach views all clients' adherence/streaks) — new `OrganizationRepository` + `CoachDashboardService`, but slots cleanly into the existing repository/service pattern.
- **Billing/subscriptions for orgs** — entirely new domain (`config/billing/`, `SubscriptionRepository`), no overlap with current code.
- **Plan template parameterization** — `plan_templates.template_data` needs its own schema (`PlanTemplateSchema`, extending `PlanDataSchema` with placeholder markers). Because `PlanDataSchema` will already live in the domain layer and be shared via `_shared/` (Section 6), this extension has exactly one place to happen.

### 7.5 Verdict

The architecture is **B2B-ready at the seams that matter** — `userId`-parameterized repositories, the modality registry, and the plan-adjustment workflow — without those seams needing to *anticipate* B2B explicitly; they're simply good layering. The B2B-specific work (orgs, RLS additions, dashboards, templates) is additive schema + new repositories/services. **No existing table needs a shape change beyond additive nullable columns, and no existing RLS policy needs modification — only new `OR` branches.**

---

## 8. Multiplatform (iOS/Android) Implications

Per [next-release/02-mobile-apps-and-wearables.md](../planning/next-release/02-mobile-apps-and-wearables.md): Capacitor wrap first (~90%+ code reuse, fastest to app stores), then React Native Phase 2 for deep HealthKit/Health Connect integration (cited as 40–70% logic reuse, UI rebuilt).

| Layer | Capacitor (wraps the existing web app) | React Native (Phase 2) |
|---|---|---|
| **Domain/Config** (`types/`, `config/modalities/`, `config/countries/`, `lib/planSchema.ts`) | 100% — no changes | **100%** — pure TS, no DOM/web deps. Highest-leverage layer to get right now. |
| **Data Access** (`repositories/`) | 100% — `@supabase/supabase-js` works in the WebView unchanged | **100%** — `@supabase/supabase-js` works in RN with the standard `react-native-url-polyfill` + AsyncStorage session adapter. Method signatures don't change. |
| **Service/Business** (`services/`, derivations) | 100% | **100%** — plain TS, no web APIs |
| **Hooks** (`useHealthProfile`, `usePlan`, ...) | 100% — same React | **~90%** — `useState`/`useEffect`/`useContext`-based hooks work identically in RN/Hermes (including `Intl`-based timezone helpers, which are polyfilled). Only hooks touching `window`/`localStorage`/DOM need adaptation. `AuthContext` as written is RN-compatible almost as-is. |
| **Presentation** (pages, `components/ui/`, Tailwind/JSX `<div>`) | 100% — it's a WebView | **0%** — must be rebuilt with `View`/`Text`/NativeWind or `StyleSheet`. Matches the roadmap's "40–70% logic reuse, UI rebuilt" framing. |

**Conclusion:** this layering directly maximizes the logic-reuse percentage cited for RN Phase 2 — by construction, everything below Presentation becomes the reusable 40–70% (likely toward the higher end, since `config/`, `services/`, `repositories/`, and most `hooks/` carry zero web-specific code). Capacitor itself needs **zero** architecture changes (it's just a WebView around the existing app) — but doing this layering now means it's already done by the time React Native Phase 2 starts, instead of being a rushed parallel effort then.

---

## 9. Phased Migration Roadmap

Each phase: independently shippable, can be paused indefinitely, and (except where noted) zero behavior change.

### Phase 0 — Extract config/constants (zero behavior change)
Move `COUNTRIES`, the region groupings, `COMMON_CUISINE_OPTIONS`/`getCuisineOptions`, `CURRENCY_INFO`/`getSupplementBudgetOptions`, `TRACKERS`, `detectCountry`/`detectTimezone` out of `OnboardingPage.tsx` into `src/config/countries/*` and `src/config/trackers.ts`. Pure cut-paste + import update. (`GOAL_MODALITIES`/`MODALITY_ORDER` stay put — Phase 2.)
- **Verify:** `npm run build`; click through every onboarding step; no visual/behavioral diff.
- **Risk:** near-zero.

### Phase 1 — Repository layer, one domain at a time
Order: `HealthProfileRepository` + `ProfileRepository` (Onboarding/Profile/Dashboard) → `PlanRepository` → `TrackingConfigRepository` → `DailyTaskRepository`/`StreakRepository` (Dashboard) → `BuddyRepository` (Buddy/JoinBuddy) → `BodyMeasurementRepository` (Profile/Progress).
- Per sub-step: create the repository, replace direct `supabase.from(...)` calls in **one page at a time**, verify the page, commit, move on.
- Add `useHealthProfile`/`useProfile` hooks; migrate `OnboardingPage.saveDraft` and `ProfilePage`.
- **Design rule (load-bearing for Section 7):** repositories accept `userId` explicitly; never call `useAuth()` internally.
- Opt-in ESLint warn-only rule: flag new `supabase.from()` outside `repositories/`.
- **Verify:** each migrated page's existing functionality (manual click-through + `npx tsc --noEmit`).
- **Risk:** low — mechanical 1:1 query replacement.

### Phase 2 — Modality registry (dedicated 3–5 day effort)
- Build `src/config/modalities/*` (Section 4), starting with `gym` — most complex, validates the abstraction.
- Build generic `StepGoalModality` + field-renderer; migrate gym first, compare side-by-side with the existing `StepGoalGym` for visual/behavioral parity, then migrate the remaining 7 modalities one at a time.
- Update `GOAL_MODALITIES` selector and `MODALITY_ORDER` to derive from the registry.
- Validate the cross-runtime sharing approach (Section 4.2) with a no-op import into `generate-plan` before wiring `describeModality`.
- Migrate `describeModality`/`MODALITY_LABELS`/`WORKOUT_MODALITIES` to the registry; **smoke-test plan generation across modality combinations** (prompt wording will shift slightly — verify output quality holds).
- **Why dedicated and sequenced first:** Ticket #18 (content library tag-matching against `activity_modalities`) and any coach/gym template builder both need this canonical registry — building it now means they consume a stable abstraction instead of each inventing their own.
- **Risk:** medium — UI-driven-by-config is the main behavioral-equivalence risk; mitigated by side-by-side comparison and reusing existing `validateStep` logic (now reading from the registry).

### Phase 3 — `PlanService` + `plan_adjustments` (folded into Ticket #17)
- Unify `planSchema.ts`: canonical `PlanDataSchema` imported by `generate-plan` via `_shared/` (same mechanism validated in Phase 2).
- Build `PlanRepository`, `PlanService.getActivePlan`/`regeneratePlan`, `usePlan`; migrate `PlanPage.tsx`'s read path and existing `regenerate()` (wrap existing functionality first — no new UI yet).
- New migration: `plan_adjustments` (additive).
- New `adjust-plan` edge function + `requestAdjustment`/`acceptAdjustment`/`declineAdjustment` + `PLAN_ADJUSTMENT_CONSTRAINTS`.
- New "Request a change" PlanPage section (additive).
- **Risk:** medium — the adjustment workflow is genuinely new product work (not refactoring), but additive to existing display.

### Phase 4 — Remaining domains (Dashboard, Buddy, Progress)
- Apply the repository/hook pattern to `DashboardPage` (daily tasks, streaks, task logs, body measurements, daily logs) and `BuddyPage`/`JoinBuddyPage`.
- Extract the more complex inline logic (streak calculation, task-seeding fallback) into `services/DashboardService.ts`/`services/StreakService.ts`, mirroring `OnboardingService`.
- **Risk:** low–medium — same mechanical pattern as Phase 1, with streak-math edge cases needing care.

### Phase 5 — AI fallback (Ticket #19) + B2B groundwork (demand-driven)
- Implement `callAIProvider(provider, prompt, schema)` per [02-ai-fallback-for-plan-generation.md](../operations/02-ai-fallback-for-plan-generation.md) in `generate-plan` and `adjust-plan` — backend-only, benefits from the `_shared/` schema unification from Phase 3.
- If/when Coach/Gym B2B is greenlit: additive migrations (`organizations`, `organization_members`, `coach_clients`, `plan_templates`, nullable `plans` columns), additive RLS (`is_coach_of()` + `OR` branches), new `CoachService`/`OrganizationRepository` — built on the `userId`-parameterized repositories (Phase 1) and registry-driven forms (Phase 2).

---

## 10. Recommendation: Refactor Now or Wait?

**Refactor incrementally, starting now** — Phase 0 immediately, Phase 1/2 within the next 1–2 feature cycles. Reasoning:

1. **The cost of not refactoring compounds specifically because of what's coming.** The current flat structure "works" at MVP scale. But three of the four upcoming workstreams — plan adjustments (Ticket #17), content library tagging (Ticket #18), and Coach/Gym B2B — all need the *same* capability: **modality/profile semantics defined once, consumed consistently by UI and AI prompts.** Building any of them on the current triplicated structure means either quadrupling the duplication, or doing this exact registry refactor later, under time pressure, underneath shipped features.

2. **The phased plan has a favorable risk/effort curve for a small team.** Phase 0 is a same-day, zero-risk cut-paste. Phase 1 (repositories) is mechanical, table-by-table, page-by-page — interleavable with other feature work, no "stop everything for two weeks" moment. This satisfies the explicit incremental/non-breaking requirement directly, so the usual "wait for a stable team/requirements before a costly rewrite" argument doesn't apply — **there is no rewrite, only a sequence of small extractions.**

3. **The modality registry (Phase 2) is needed regardless of B2B.** Even without coach/gym, Ticket #18 needs a canonical modality ID/label/tag list to match content against `activity_modalities` — today that list only half-exists, in two inconsistent places. Building the registry now means Ticket #18 (and any future coach template builder) consumes a stable abstraction from day one.

4. **Counter-consideration, addressed directly.** "Ship features, defer architecture" is the right call *when the architecture doesn't block the features*. Here it's borderline: onboarding and plan generation work today. But the planned features aren't bolt-ons — they're variations on "modality-aware, AI-prompt-generating, schema-validated profile data," which is exactly the abstraction this refactor builds. Deferring means building those features once on the ad-hoc structure, then refactoring *underneath already-shipped features* later (harder, riskier, larger regression surface) — versus refactoring *before* those features exist, where the new features become the registry's first consumers and validate it for free.

5. **Concrete sequencing:**
   - **Now:** Phase 0 (trivial, same day).
   - **Opportunistic ("boy scout rule"):** Phase 1 — every time a page is touched for an unrelated bugfix/feature, migrate that page's queries to repositories in the same PR.
   - **Dedicated 3–5 day effort, before Ticket #18 or any coach/gym work:** Phase 2 (modality registry) — both depend on it.
   - **Folded into Ticket #17's own implementation:** Phase 3 (PlanService/adjustments) — build the service layer *as part of* that feature, not as a separate prerequisite.
   - **Demand-driven:** Phase 5 (AI fallback abstraction, B2B groundwork).

**Bottom line:** this isn't "refactor vs. build features" — it's "build the next 2–3 features (adjustments, content library, coach templates) on a foundation that's shared and consistent, vs. build them on triplicated ad-hoc logic and pay it back later with interest." Given the incremental/non-breaking constraint is achievable (Section 9), there's no "wait" option that's actually cheaper.

---

## Critical files referenced

- `src/pages/OnboardingPage.tsx`
- `src/pages/PlanPage.tsx`
- `supabase/functions/generate-plan/index.ts`
- `src/lib/planSchema.ts`
- `src/types/index.ts`
- `src/contexts/AuthContext.tsx`
