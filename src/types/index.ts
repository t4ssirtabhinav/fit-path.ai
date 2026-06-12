import type { Database } from './database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type HealthProfile = Database['public']['Tables']['health_profiles']['Row'];
export type Plan = Database['public']['Tables']['plans']['Row'];
export type DailyTask = Database['public']['Tables']['daily_tasks']['Row'];
export type TaskLog = Database['public']['Tables']['task_logs']['Row'];
export type BodyMeasurement = Database['public']['Tables']['body_measurements']['Row'];
export type Streak = Database['public']['Tables']['streaks']['Row'];
export type Buddy = Database['public']['Tables']['buddies']['Row'];
export type DailyLog = Database['public']['Tables']['daily_logs']['Row'];
export type Milestone = Database['public']['Tables']['milestones']['Row'];
export type TrackingConfig = Database['public']['Tables']['tracking_config']['Row'];
export type ExerciseLog = Database['public']['Tables']['exercise_logs']['Row'];

export interface ExerciseSet {
  reps: number;
  weight: number;
}

export type TaskCategory = 'workout' | 'meal' | 'supplement' | 'habit' | 'sleep';

export interface DailyTaskWithLog extends DailyTask {
  log?: TaskLog;
}

export interface PlanData {
  phase: number;
  phase_name: string;
  phase_description: string;
  duration_months: number;
  weekly_schedule?: WeeklySchedule;
  daily_meals?: MealPlan;
  supplements?: Supplement[];
  daily_habits?: Habit[];
  sleep_protocol?: SleepProtocol;
  suggested_addons?: SuggestedAddon[];
  personalized_notes: string;
  calorie_target: number;
  protein_target_g: number;
}

export interface SuggestedAddon {
  area: string;
  reason: string;
}

export interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  is_rest_day: boolean;
  workout?: WorkoutSession;
}

export interface WorkoutSession {
  name: string;
  duration_minutes: number;
  exercises: Exercise[];
  notes?: string;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  intensity_guidance?: string;
  progression_notes?: string;
}

export interface MealPlan {
  breakfast: Meal;
  mid_morning_snack: Meal;
  lunch: Meal;
  evening_snack: Meal;
  dinner: Meal;
  pre_sleep?: Meal;
}

export interface Meal {
  title: string;
  items: string[];
  protein_g: number;
  calories: number;
  notes?: string;
}

export interface Supplement {
  name: string;
  dosage: string;
  timing: string;
  reason: string;
  phase_start: number;
  what_to_look_for?: string;
  approx_cost_local?: string;
}

export interface Habit {
  title: string;
  description: string;
  timing: string;
  category: string;
}

export interface SleepProtocol {
  target_bedtime: string;
  target_wake_time: string;
  sleep_hours_target: number;
  tips: string[];
}

export interface BuddyWithProfile {
  buddy: Buddy;
  profile: Profile;
  streak: Streak;
}

export interface BuddyDetail {
  id: string;
  name: string;
  streak: number;
  longestStreak: number;
  totalActive: number;
  missedDays: number;
  monthlyRate: number;
  completionPct: number;
  buddyRelId: string;
}

// ===== ONBOARDING TYPES =====

export type GoalModality = 'gym' | 'yoga' | 'cardio' | 'home' | 'physio' | 'diet' | 'supplements' | 'concerns';

export interface GymDetails {
  experience: string;
  equipment: string;
  days_per_week: number;
  primary_focus: string[];
}

export interface YogaDetails {
  experience: string;
  session_duration: string;
  goals: string[];
  style: string;
}

export interface CardioDetails {
  baseline: string;
  activities: string[];
  goal: string;
  days_per_week: number;
}

export interface HomeDetails {
  equipment: string[];
  space: string;
  fitness_level: string;
  primary_focus: string[];
}

export interface PhysioDetails {
  reason: string;
  areas: string[];
  duration: string;
  has_professional: string;
}

export interface DietDetails {
  diet_type: string;
  dietary_goal: string;
  cuisine_style: string[];
  allergies: string[];
  food_dislikes: string[];
  conditions: string[];
}

export interface SupplementDetails {
  current: string[];
  goals: string[];
  budget: string;
  veg_preferred: boolean;
}

export interface ConcernsDetails {
  items: string[];
  on_medication: string;
}

export interface GoalDetails {
  gym?: GymDetails;
  yoga?: YogaDetails;
  cardio?: CardioDetails;
  home?: HomeDetails;
  physio?: PhysioDetails;
  diet?: DietDetails;
  supplements?: SupplementDetails;
  concerns?: ConcernsDetails;
}

export interface OnboardingTrackingConfig {
  selected_trackers: string[];
  reminder_morning: string;
  reminder_evening: string;
  reminder_style: string;
}

export interface OnboardingData {
  display_name: string;
  country: string;
  age: number;
  gender: string;
  weight_kg: number;
  height_cm: number;
  onboarding_path: 'plan' | 'track' | null;
  activity_modalities: GoalModality[];
  goal_details: GoalDetails;
  sleep_hours_current: number;
  stress_level: number;
  hydration_level: string;
  job_type: string;
  preferred_workout_time: string;
  goal_timeline_months: number;
  lifestyle_injuries: string;
  medications: string;
  personalization_comments: string;
  tracking_config: OnboardingTrackingConfig;
}
