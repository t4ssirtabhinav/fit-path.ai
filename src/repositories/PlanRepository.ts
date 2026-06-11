import { supabase } from '../lib/supabase';
import type { Plan } from '../types';

export const PlanRepository = {
  async getActivePlan(userId: string): Promise<Plan | null> {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getHistory(userId: string): Promise<Pick<Plan, 'id' | 'phase' | 'is_active' | 'generated_at'>[]> {
    const { data, error } = await supabase
      .from('plans')
      .select('id, phase, is_active, generated_at')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getAllPlanData(userId: string): Promise<Pick<Plan, 'phase' | 'plan_data' | 'generated_at'>[]> {
    const { data, error } = await supabase
      .from('plans')
      .select('phase, plan_data, generated_at')
      .eq('user_id', userId);
    if (error) throw error;
    return data ?? [];
  },
};
