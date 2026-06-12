import type { PlanData, DaySchedule, Exercise, DailyTask } from '../types';

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export function today(timezone: string = DEFAULT_TIMEZONE): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

export function yesterday(timezone: string = DEFAULT_TIMEZONE): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: timezone });
}

export function getDayName(date: Date | string, timezone: string = DEFAULT_TIMEZONE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }).toLowerCase() as string;
}

export function getTodaysExercises(planData: PlanData | null, timezone: string = DEFAULT_TIMEZONE): Exercise[] {
  if (!planData?.weekly_schedule) return [];
  const dayName = getDayName(new Date(), timezone);
  const day = (planData.weekly_schedule as unknown as Record<string, DaySchedule>)[dayName];
  return day?.workout?.exercises ?? [];
}

export function parseLeadingInt(value: string): number {
  const match = value.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

const DURATION_REPS_PATTERN = /min|sec|hour|hr\b|hold|km|round|amrap/i;

export function getExerciseType(ex: Exercise): 'reps_weight' | 'duration' {
  if (ex.exercise_type) return ex.exercise_type;
  return DURATION_REPS_PATTERN.test(ex.reps) ? 'duration' : 'reps_weight';
}

export function getTaskInputType(task: DailyTask): 'numeric' | 'rating' | 'notes' | 'measurement' | 'exercise' | 'none' {
  if (task.category === 'workout') return 'exercise';
  if (task.category === 'supplement') return 'none';
  if (task.unit === 'rating') return 'rating';
  if (task.unit === 'measurement') return 'measurement';
  if (task.unit) return 'numeric';
  return 'notes';
}

export function calcBMI(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

export function getBMILabel(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}
