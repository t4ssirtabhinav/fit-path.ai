import { useEffect, useState } from 'react';
import { PlanRepository } from '../repositories/PlanRepository';
import { parsePlanData } from '../lib/planSchema';
import type { PlanData } from '../types';

export interface PlanMeta {
  generated_at: string;
  last_regenerated_at: string | null;
}

export function usePlan(userId: string | undefined) {
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [planDataInvalid, setPlanDataInvalid] = useState(false);
  const [planMeta, setPlanMeta] = useState<PlanMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    PlanRepository.getActivePlan(userId).then(data => {
      if (cancelled) return;
      if (data) {
        const parsed = parsePlanData(data.plan_data);
        setPlanData(parsed);
        setPlanDataInvalid(!parsed);
        setPlanMeta({ generated_at: data.generated_at, last_regenerated_at: data.last_regenerated_at });
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  return { planData, planDataInvalid, planMeta, loading, setPlanData, setPlanDataInvalid, setPlanMeta };
}
