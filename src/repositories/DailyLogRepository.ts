import { supabase } from '../lib/supabase';
import type { DailyLog } from '../types';
import type { Database } from '../types/database';

type DailyLogInsert = Database['public']['Tables']['daily_logs']['Insert'];

export const DailyLogRepository = {
  async getForDate(userId: string, date: string): Promise<DailyLog | null> {
    const { data, error } = await supabase.from('daily_logs').select('*').eq('user_id', userId).eq('log_date', date).maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsert(entry: DailyLogInsert): Promise<void> {
    const { error } = await supabase.from('daily_logs').upsert(entry, { onConflict: 'user_id,log_date' });
    if (error) throw error;
  },
};
