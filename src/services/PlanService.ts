import { supabase } from '../lib/supabase';
import { PlanRepository } from '../repositories/PlanRepository';
import { parsePlanData } from '../lib/planSchema';
import type { Plan, PlanData } from '../types';

export type ActivePlanResult =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'ok'; plan: Plan; data: PlanData };

export const PlanService = {
  async getActivePlan(userId: string): Promise<ActivePlanResult> {
    const plan = await PlanRepository.getActivePlan(userId);
    if (!plan) return { status: 'none' };
    const data = parsePlanData(plan.plan_data);
    if (!data) return { status: 'invalid' };
    return { status: 'ok', plan, data };
  },

  async regeneratePlan(): Promise<PlanData> {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-plan`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
        Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ regenerate: true }),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to regenerate');
    }
    const parsed = parsePlanData(result.plan.plan_data);
    if (!parsed) {
      throw new Error('Regenerated plan data is in an unexpected format.');
    }
    return parsed;
  },
};
