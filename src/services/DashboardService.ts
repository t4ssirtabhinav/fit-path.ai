import { parsePlanData } from '../lib/planSchema';
import { DailyTaskRepository } from '../repositories/DailyTaskRepository';
import { today } from '../lib/utils';
import type { DailyTask } from '../types';
import type { Database } from '../types/database';

type DailyTaskInsert = Database['public']['Tables']['daily_tasks']['Insert'];

const TRACKER_TASKS: Record<string, { category: DailyTask['category']; title: string; description: string; unit?: string }> = {
  workouts: { category: 'workout', title: 'Log your workout', description: "Record the exercises, sets, reps, and weights from today's session." },
  steps: { category: 'habit', title: 'Log steps & distance', description: 'Track how much you moved today.', unit: 'steps' },
  meals: { category: 'meal', title: 'Log your meals', description: 'Note what you ate today using the Log notes button.' },
  macros: { category: 'meal', title: 'Log your macros', description: 'Track protein, carbs, fat, and calories.' },
  supplements: { category: 'supplement', title: 'Log supplements', description: 'Check off the supplements you took today.' },
  measurements: { category: 'habit', title: 'Log body measurements', description: 'Use the Log weight button to record weight, waist, and other measurements.', unit: 'measurement' },
  vitals: { category: 'habit', title: 'Log vitals', description: 'Record blood pressure, heart rate, or blood sugar via Log notes.' },
  sleep: { category: 'sleep', title: 'Log sleep', description: 'Note your bedtime, wake time, and sleep quality.' },
  water: { category: 'habit', title: 'Log water intake', description: 'Track how much water you drank today.', unit: 'glasses' },
  mood: { category: 'habit', title: 'Log mood & energy', description: 'Rate your energy level using the Log notes button.', unit: 'rating' },
};

export const DashboardService = {
  async seedTrackingTasks(userId: string, selectedTrackers: string[], timezone: string): Promise<void> {
    const todayStr = today(timezone);
    if (await DailyTaskRepository.hasTasksForDate(userId, todayStr)) return;

    const tasks: DailyTaskInsert[] = selectedTrackers
      .map((id, idx): DailyTaskInsert | null => {
        const cfg = TRACKER_TASKS[id];
        if (!cfg) return null;
        return { user_id: userId, task_date: todayStr, ...cfg, order_index: idx, is_rest_day: false };
      })
      .filter((t): t is DailyTaskInsert => t !== null);

    await DailyTaskRepository.seedTasks(tasks);
  },

  async seedTasksFromPlan(userId: string, planId: string, rawPlanData: unknown, timezone: string): Promise<void> {
    const planData = parsePlanData(rawPlanData);
    if (!planData) return;

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }).toLowerCase();

    // Only seed if no tasks exist for today (prevent duplication)
    if (await DailyTaskRepository.hasTasksForDate(userId, todayStr)) return;

    const tasks: DailyTaskInsert[] = [];
    let idx = 0;

    const scheduleMap = planData.weekly_schedule as Record<string, { is_rest_day: boolean; workout?: { name: string; exercises: Array<{ name: string; sets: number; reps: string; intensity_guidance?: string }> } }> | undefined;
    const schedule = scheduleMap?.[dayName];
    if (schedule) {
      if (schedule.is_rest_day) {
        tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'habit', title: 'Rest & Recovery Day', description: 'Light walk, stretching, or yoga. Let your muscles recover.', order_index: idx++, is_rest_day: true });
      } else if (schedule.workout) {
        tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'workout', title: schedule.workout.name, description: schedule.workout.exercises.map((e) => `${e.name}: ${e.sets}x${e.reps}${e.intensity_guidance ? ` — ${e.intensity_guidance}` : ''}`).join(' • '), order_index: idx++, is_rest_day: false });
      }
    } else if (scheduleMap) {
      // Fallback: if the day is missing from schedule, treat as rest day
      tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'habit', title: 'Rest & Recovery Day', description: 'Light walk, stretching, or yoga.', order_index: idx++, is_rest_day: true });
    }

    const meals = (planData.daily_meals as unknown as Record<string, { title: string; items: string[] }> | undefined) ?? {};
    const mealLabels: Record<string, string> = {
      breakfast: 'Breakfast',
      mid_morning_snack: 'Mid-morning Snack',
      lunch: 'Lunch',
      evening_snack: 'Evening Snack',
      dinner: 'Dinner',
      pre_sleep: 'Pre-sleep',
    };
    for (const [key, meal] of Object.entries(meals)) {
      const label = mealLabels[key] || key.replace(/_/g, ' ');
      tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'meal', title: `${label}: ${meal.title}`, description: meal.items.slice(0, 3).join(', '), order_index: idx++, is_rest_day: false });
    }

    const supplements = ((planData.supplements as Array<{ name: string; dosage: string; timing: string; phase_start: number }>) ?? []).filter(s => s.phase_start === 1).slice(0, 4);
    for (const s of supplements) {
      tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'supplement', title: s.name, description: `${s.dosage} — ${s.timing}`, order_index: idx++, is_rest_day: false });
    }

    const habits = ((planData.daily_habits as Array<{ title: string; description: string; timing: string }>) ?? []).slice(0, 5);
    for (const h of habits) {
      tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'habit', title: h.title, description: `${h.timing} — ${h.description}`, order_index: idx++, is_rest_day: false });
    }

    const sleep = planData.sleep_protocol as { target_bedtime: string; target_wake_time: string } | undefined;
    if (sleep) {
      tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'sleep', title: `Sleep by ${sleep.target_bedtime}`, description: `Wake at ${sleep.target_wake_time}`, order_index: idx++, is_rest_day: false });
    }

    // Upsert (rather than insert) so that a racing duplicate seed attempt
    // (e.g. this effect firing twice before the first insert commits) is a
    // no-op instead of creating duplicate rows for the same day.
    await DailyTaskRepository.seedTasks(tasks);
  },
};
