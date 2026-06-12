import { supabase } from '../lib/supabase';
import type { TrackingConfig } from '../types';
import type { Database } from '../types/database';

type TrackingConfigInsert = Database['public']['Tables']['tracking_config']['Insert'];

export const TrackingConfigRepository = {
  async getForUser(userId: string): Promise<TrackingConfig | null> {
    const { data, error } = await supabase
      .from('tracking_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsert(userId: string, fields: Omit<TrackingConfigInsert, 'user_id'>): Promise<void> {
    const { error } = await supabase
      .from('tracking_config')
      .upsert({ user_id: userId, ...fields }, { onConflict: 'user_id' });
    if (error) throw error;
  },
};
