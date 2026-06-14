import { StreakRepository } from '../repositories/StreakRepository';
import { yesterday } from '../lib/utils';
import type { Streak } from '../types';

export const StreakService = {
  // Records today's completion activity and persists the updated streak.
  // Returns the updated streak, or null if the user has no streak row yet.
  async recordCompletion(userId: string, completedAny: boolean, todayDate: string, tz: string): Promise<Streak | null> {
    const current = await StreakRepository.getForUser(userId);
    if (!current) return null;

    const yest = yesterday(tz);

    let newStreak = current.current_streak;
    if (completedAny && current.last_active_date !== todayDate) {
      newStreak = current.last_active_date === yest ? current.current_streak + 1 : 1;
    }

    const updated = {
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, current.longest_streak),
      last_active_date: completedAny ? todayDate : current.last_active_date,
      total_active_days: completedAny && current.last_active_date !== todayDate ? current.total_active_days + 1 : current.total_active_days,
      updated_at: new Date().toISOString(),
    };

    await StreakRepository.update(userId, updated);
    return { ...current, ...updated };
  },
};
