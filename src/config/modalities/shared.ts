// Zero-dependency modality metadata shared between the frontend (Vite) and the
// `generate-plan` edge function (Deno). Do not import zod, React, or anything
// that isn't resolvable identically in both runtimes.

export type GoalModality = 'gym' | 'yoga' | 'cardio' | 'home' | 'physio' | 'diet' | 'supplements' | 'concerns';

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export const WEEKDAY_OPTIONS: { value: string; label: string }[] = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

export interface PromptModalityInfo {
  id: GoalModality;
  /** Short label used when describing the user's overall activity mix to the LLM. */
  label: string;
  /** Whether this modality contributes structured workout days to weekly_schedule. */
  isWorkoutModality: boolean;
  /** One-line summary of the user's goal_details for this modality, for the prompt. */
  describeForPrompt(details: Record<string, unknown> | undefined): string;
}

function safeList(val: unknown, fallback = 'none'): string {
  return Array.isArray(val) && val.length > 0 ? (val as string[]).join(', ') : fallback;
}

/** Safe lookup for modality strings of unknown/loose origin (e.g. from the database). */
export function getPromptInfo(modality: string): PromptModalityInfo | undefined {
  return (MODALITY_PROMPT_INFO as Record<string, PromptModalityInfo>)[modality];
}

export const MODALITY_PROMPT_INFO: Record<GoalModality, PromptModalityInfo> = {
  gym: {
    id: 'gym',
    label: 'gym/strength training',
    isWorkoutModality: true,
    describeForPrompt: (d = {}) =>
      `Gym/strength training — experience: ${d.experience ?? 'unspecified'}, equipment access: ${d.equipment ?? 'unspecified'}, ${d.days_per_week ?? '?'} sessions/week, focus areas: ${safeList(d.primary_focus)}`,
  },
  yoga: {
    id: 'yoga',
    label: 'yoga practice',
    isWorkoutModality: true,
    describeForPrompt: (d = {}) =>
      `Yoga — experience: ${d.experience ?? 'unspecified'}, session length: ${d.session_duration ?? 'unspecified'}, style: ${d.style ?? 'general'}, goals: ${safeList(d.goals)}`,
  },
  cardio: {
    id: 'cardio',
    label: 'cardio training',
    isWorkoutModality: true,
    describeForPrompt: (d = {}) =>
      `Cardio — current baseline: ${d.baseline ?? 'unspecified'}, preferred activities: ${safeList(d.activities)}, goal: ${d.goal ?? 'general fitness'}, ${d.days_per_week ?? '?'} sessions/week`,
  },
  home: {
    id: 'home',
    label: 'home workouts',
    isWorkoutModality: true,
    describeForPrompt: (d = {}) =>
      `Home workouts — available equipment: ${safeList(d.equipment, 'bodyweight only')}, space: ${d.space ?? 'limited'}, level: ${d.fitness_level ?? 'beginner'}, focus areas: ${safeList(d.primary_focus)}`,
  },
  physio: {
    id: 'physio',
    label: 'physiotherapy/rehab sessions',
    isWorkoutModality: true,
    describeForPrompt: (d = {}) =>
      `Physiotherapy/rehab — reason: ${d.reason ?? 'unspecified'}, target areas: ${safeList(d.areas)}, duration so far: ${d.duration ?? 'unspecified'}, working with a professional: ${d.has_professional ?? 'unknown'}`,
  },
  diet: {
    id: 'diet',
    label: 'diet & nutrition planning',
    isWorkoutModality: false,
    describeForPrompt: (d = {}) =>
      `Diet/nutrition focus — type: ${d.diet_type ?? 'unspecified'}, goal: ${d.dietary_goal ?? 'general health'}, cuisine preferences: ${safeList(d.cuisine_style)}`,
  },
  supplements: {
    id: 'supplements',
    label: 'supplement guidance',
    isWorkoutModality: false,
    describeForPrompt: (d = {}) =>
      `Supplements — currently taking: ${safeList(d.current)}, goals: ${safeList(d.goals)}, monthly budget: ${d.budget ?? 'unspecified'}, prefers vegetarian sources: ${d.veg_preferred ? 'yes' : 'no'}`,
  },
  concerns: {
    id: 'concerns',
    label: 'other health concerns',
    isWorkoutModality: false,
    describeForPrompt: (d = {}) =>
      `Health concerns to factor in — ${safeList(d.items)}; currently on medication: ${d.on_medication ?? 'unknown'}`,
  },
};
