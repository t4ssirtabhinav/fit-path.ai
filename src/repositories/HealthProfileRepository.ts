import { supabase } from '../lib/supabase';
import type { HealthProfile } from '../types';
import type { Database } from '../types/database';

type HealthProfileInsert = Database['public']['Tables']['health_profiles']['Insert'];

export const HealthProfileRepository = {
  async getForUser(userId: string): Promise<HealthProfile | null> {
    const { data, error } = await supabase
      .from('health_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsert(userId: string, fields: Omit<HealthProfileInsert, 'user_id'>): Promise<void> {
    const { error } = await supabase
      .from('health_profiles')
      .upsert({ ...fields, user_id: userId }, { onConflict: 'user_id' });
    if (error) throw error;
  },

  async delete(userId: string): Promise<void> {
    const { error } = await supabase.from('health_profiles').delete().eq('user_id', userId);
    if (error) throw error;
  },
};
