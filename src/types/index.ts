import type { Database } from './database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type HealthProfile = Database['public']['Tables']['health_profiles']['Row'];
export type Plan = Database['public']['Tables']['plans']['Row'];
export type DailyTask = Database['public']['Tables']['daily_tasks']['Row'];
export type TaskLog = Database['public']['Tables']['task_logs']['Row'];
export type BodyMeasurement = Database['public']['Tables']['body_measurements']['Row'];
export type Streak = Database['public']['Tables']['streaks']['Row'];
export type Buddy = Database['public']['Tables']['buddies']['Row'];

export type TaskCategory = 'workout' | 'meal' | 'supplement' | 'habit' | 'sleep';

export interface DailyTaskWithLog extends DailyTask {
  log?: TaskLog;
}

export interface PlanData {
  phase: number;
  phase_name: string;
  phase_description: string;
  duration_months: number;
  weekly_schedule: WeeklySchedule;
  daily_meals: MealPlan;
  supplements: Supplement[];
  daily_habits: Habit[];
  sleep_protocol: SleepProtocol;
  personalized_notes: string;
  calorie_target: number;
  protein_target_g: number;
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
  notes?: string;
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
  indian_brand?: string;
  approx_cost_inr?: string;
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

export interface OnboardingData {
  display_name: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  gender: string;
  fitness_goals: string[];
  body_type: string;
  activity_level: string;
  diet_type: string;
  health_concerns: string[];
  injuries: string[];
  sleep_hours_current: number;
  commitment_days_per_week: number;
  preferred_workout_time: string;
  food_preferences: string[];
  food_dislikes: string[];
  goal_timeline_months: number;
  medications: string;
}
