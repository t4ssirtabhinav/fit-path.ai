import { supabase } from '../lib/supabase';
import type { ExerciseLog } from '../types';
import type { Database } from '../types/database';

type ExerciseLogInsert = Database['public']['Tables']['exercise_logs']['Insert'];

export const ExerciseLogRepository = {
  async getForDate(userId: string, date: string): Promise<ExerciseLog[]> {
    const { data, error } = await supabase.from('exercise_logs').select('*').eq('user_id', userId).eq('task_date', date);
    if (error) throw error;
    return data ?? [];
  },

  async upsert(entry: ExerciseLogInsert): Promise<void> {
    const { error } = await supabase.from('exercise_logs').upsert(entry, { onConflict: 'user_id,task_date,exercise_name' });
    if (error) throw error;
  },
};
