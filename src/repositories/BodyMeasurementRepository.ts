import { supabase } from '../lib/supabase';
import type { BodyMeasurement } from '../types';
import type { Database } from '../types/database';

type BodyMeasurementInsert = Database['public']['Tables']['body_measurements']['Insert'];

export const BodyMeasurementRepository = {
  async getAllForUser(userId: string): Promise<BodyMeasurement[]> {
    const { data, error } = await supabase.from('body_measurements').select('*').eq('user_id', userId);
    if (error) throw error;
    return data ?? [];
  },

  async getSince(userId: string, sinceDate: string): Promise<Pick<BodyMeasurement, 'measured_at' | 'weight_kg' | 'waist_cm'>[]> {
    const { data, error } = await supabase
      .from('body_measurements')
      .select('measured_at, weight_kg, waist_cm')
      .eq('user_id', userId)
      .gte('measured_at', sinceDate)
      .order('measured_at');
    if (error) throw error;
    return data ?? [];
  },

  async create(fields: BodyMeasurementInsert): Promise<void> {
    const { error } = await supabase.from('body_measurements').insert(fields);
    if (error) throw error;
  },
};
