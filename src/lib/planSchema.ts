import { z } from 'zod';
import type { PlanData } from '../types';

// Mirrors the Zod schema in supabase/functions/generate-plan/index.ts.
// Re-validated on read since plan_data is stored as jsonb — the row in the DB
// could in principle be edited or come from an older/different schema version.
const ExerciseSchema = z.object({
  name: z.string(),
  sets: z.number(),
  reps: z.string(),
  rest_seconds: z.number(),
  notes: z.string().optional(),
});

const WorkoutSchema = z.object({
  name: z.string(),
  duration_minutes: z.number(),
  exercises: z.array(ExerciseSchema).min(1),
  notes: z.string().optional(),
});

const DayScheduleSchema = z.object({
  is_rest_day: z.boolean(),
  workout: WorkoutSchema.optional(),
});

const MealSchema = z.object({
  title: z.string(),
  items: z.array(z.string()),
  protein_g: z.number(),
  calories: z.number(),
  notes: z.string().optional(),
});

const SupplementSchema = z.object({
  name: z.string(),
  dosage: z.string(),
  timing: z.string(),
  reason: z.string(),
  phase_start: z.number(),
  what_to_look_for: z.string().optional(),
  approx_cost_local: z.string().optional(),
});

const HabitSchema = z.object({
  title: z.string(),
  description: z.string(),
  timing: z.string(),
  category: z.string(),
});

const SleepProtocolSchema = z.object({
  target_bedtime: z.string(),
  target_wake_time: z.string(),
  sleep_hours_target: z.number(),
  tips: z.array(z.string()),
});

const SuggestedAddonSchema = z.object({
  area: z.string(),
  reason: z.string(),
});

export const PlanDataSchema = z.object({
  phase: z.number(),
  phase_name: z.string(),
  phase_description: z.string(),
  duration_months: z.number(),
  personalized_notes: z.string(),
  calorie_target: z.number(),
  protein_target_g: z.number(),
  weekly_schedule: z.record(z.string(), DayScheduleSchema).optional(),
  daily_meals: z.object({
    breakfast: MealSchema,
    mid_morning_snack: MealSchema,
    lunch: MealSchema,
    evening_snack: MealSchema,
    dinner: MealSchema,
    pre_sleep: MealSchema.optional(),
  }).optional(),
  supplements: z.array(SupplementSchema).optional(),
  daily_habits: z.array(HabitSchema).optional(),
  sleep_protocol: SleepProtocolSchema.optional(),
  suggested_addons: z.array(SuggestedAddonSchema).optional(),
});

export function parsePlanData(raw: unknown): PlanData | null {
  const result = PlanDataSchema.safeParse(raw);
  if (!result.success) {
    console.error('plan_data failed schema validation:', result.error.issues);
    return null;
  }
  return result.data as PlanData;
}
