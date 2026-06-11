import { supabase } from '../lib/supabase';
import type { Streak } from '../types';
import type { Database } from '../types/database';

type StreakUpdate = Database['public']['Tables']['streaks']['Update'];

export const StreakRepository = {
  async getForUser(userId: string): Promise<Streak | null> {
    const { data, error } = await supabase.from('streaks').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async getForUsers(userIds: string[]): Promise<Streak[]> {
    const { data, error } = await supabase.from('streaks').select('*').in('user_id', userIds);
    if (error) throw error;
    return data ?? [];
  },

  async update(userId: string, fields: StreakUpdate): Promise<void> {
    const { error } = await supabase.from('streaks').update(fields).eq('user_id', userId);
    if (error) throw error;
  },
};
