import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ProfileRepository } from '../repositories/ProfileRepository';
import type { Profile } from '../types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const data = await ProfileRepository.getForUser(userId);
    setProfile(data);
    return data;
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  const LAST_ACTIVE_THROTTLE_MS = 15 * 60 * 1000;

  async function touchLastActive(userId: string, currentProfile: Profile | null) {
    const last = currentProfile?.last_active_at ? new Date(currentProfile.last_active_at).getTime() : 0;
    if (Date.now() - last < LAST_ACTIVE_THROTTLE_MS) return;
    const now = new Date().toISOString();
    await ProfileRepository.update(userId, { last_active_at: now });
    setProfile(prev => (prev ? { ...prev, last_active_at: now } : prev));
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id)
          .then(data => touchLastActive(session.user.id, data))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          const data = await fetchProfile(session.user.id);
          await touchLastActive(session.user.id, data);
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
