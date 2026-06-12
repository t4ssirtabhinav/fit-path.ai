import { useEffect, useState } from 'react';
import { PlanService } from '../services/PlanService';
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
    PlanService.getActivePlan(userId).then(result => {
      if (cancelled) return;
      if (result.status === 'ok') {
        setPlanData(result.data);
        setPlanDataInvalid(false);
        setPlanMeta({ generated_at: result.plan.generated_at, last_regenerated_at: result.plan.last_regenerated_at });
      } else if (result.status === 'invalid') {
        setPlanDataInvalid(true);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  async function regenerate() {
    const data = await PlanService.regeneratePlan();
    setPlanData(data);
    setPlanDataInvalid(false);
  }

  return { planData, planDataInvalid, planMeta, loading, setPlanData, setPlanDataInvalid, setPlanMeta, regenerate };
}
