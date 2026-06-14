import { supabase } from '../lib/supabase';
import type { Buddy } from '../types';

export const BuddyRepository = {
  async getRelations(userId: string): Promise<Buddy[]> {
    const { data, error } = await supabase
      .from('buddies')
      .select('*')
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
      .neq('status', 'declined');
    if (error) throw error;
    return data ?? [];
  },

  async hasPendingOrActiveConnection(requesterId: string, recipientId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('buddies')
      .select('id')
      .eq('requester_id', requesterId)
      .eq('recipient_id', recipientId)
      .in('status', ['pending', 'active'])
      .maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async create(requesterId: string, recipientId: string): Promise<{ error: { code?: string } | null }> {
    const { error } = await supabase.from('buddies').insert({ requester_id: requesterId, recipient_id: recipientId });
    return { error };
  },

  async updateStatus(id: string, status: 'active' | 'declined'): Promise<void> {
    const { error } = await supabase.from('buddies').update({ status }).eq('id', id);
    if (error) throw error;
  },

  async lookupByInviteCode(code: string): Promise<{ id: string; display_name: string }[] | null> {
    const { data, error } = await supabase.rpc('lookup_profile_by_invite_code', { code });
    if (error) return null;
    return data;
  },
};
