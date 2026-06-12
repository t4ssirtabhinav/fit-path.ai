import { useCallback, useEffect, useState } from 'react';
import { HealthProfileRepository } from '../repositories/HealthProfileRepository';
import type { HealthProfile } from '../types';

export function useHealthProfile(userId: string | undefined) {
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setHealthProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await HealthProfileRepository.getForUser(userId);
    setHealthProfile(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { healthProfile, loading, refresh };
}
