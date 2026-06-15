import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import type { Database } from '../types/database';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export const ProfileRepository = {
  async getForUser(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getByIds(userIds: string[]): Promise<Pick<Profile, 'id' | 'display_name' | 'avatar_url'>[]> {
    const { data, error } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
    if (error) throw error;
    return data ?? [];
  },

  async update(userId: string, updates: ProfileUpdate): Promise<void> {
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) throw error;
  },

  async delete(userId: string): Promise<void> {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
  },
};
