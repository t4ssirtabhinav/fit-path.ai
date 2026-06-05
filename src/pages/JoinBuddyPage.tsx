import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';

export function JoinBuddyPage() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetName, setTargetName] = useState('');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    // Use SECURITY DEFINER function instead of direct table query
    supabase.rpc('lookup_profile_by_invite_code', { code: code.toUpperCase() }).then(({ data, error: rpcError }) => {
      if (rpcError || !data || data.length === 0) {
        setError('This invite link is invalid or has expired.');
      } else {
        setTargetId(data[0].id);
        setTargetName(data[0].display_name);
      }
      setLoading(false);
    });
  }, [code]);

  async function connect() {
    if (!user || !targetId) return;
    setConnecting(true);
    if (targetId === user.id) { setError("You can't buddy with yourself."); setConnecting(false); return; }
    // Check for existing pending or active connection before inserting
    const { data: existing } = await supabase.from('buddies')
      .select('id')
      .eq('requester_id', user.id)
      .eq('recipient_id', targetId)
      .in('status', ['pending', 'active'])
      .maybeSingle();
    if (existing) {
      setError('You already have a pending or active connection with this person.');
      setConnecting(false);
      return;
    }
    // Also check reverse direction
    const { data: reverseExisting } = await supabase.from('buddies')
      .select('id')
      .eq('requester_id', targetId)
      .eq('recipient_id', user.id)
      .in('status', ['pending', 'active'])
      .maybeSingle();
    if (reverseExisting) {
      setError('You already have a pending or active connection with this person.');
      setConnecting(false);
      return;
    }
    const { error: insertError } = await supabase.from('buddies').insert({ requester_id: user.id, recipient_id: targetId });
    if (insertError) {
      setError('Could not connect. Please try again.');
    } else {
      setDone(true);
    }
    setConnecting(false);
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white font-semibold mb-4">Sign in to accept this buddy invite</p>
          <Button onClick={() => navigate(`/register?redirect=/join/${code}`)}>Create account</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-6">
          {done ? <Check className="w-8 h-8 text-emerald-400" /> : error ? <AlertCircle className="w-8 h-8 text-red-400" /> : <Users className="w-8 h-8 text-emerald-400" />}
        </div>
        {loading ? (
          <p className="text-gray-400">Loading invite...</p>
        ) : error ? (
          <>
            <h1 className="text-xl font-bold text-white mb-2">Invalid invite</h1>
            <p className="text-red-400 text-sm mb-6">{error}</p>
            <Button onClick={() => navigate('/buddy')}>Go to buddy page</Button>
          </>
        ) : done ? (
          <>
            <h1 className="text-xl font-bold text-white mb-2">Request sent!</h1>
            <p className="text-gray-400 text-sm mb-6">{targetName} will need to accept your request.</p>
            <Button onClick={() => navigate('/dashboard')}>Go to dashboard</Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white mb-2">Buddy invite</h1>
            <p className="text-gray-400 text-sm mb-6">
              <span className="text-white font-semibold">{targetName}</span> wants you as their accountability buddy. Accept to see each other's streaks and compete.
            </p>
            <Button onClick={connect} loading={connecting} className="w-full mb-3">Accept buddy request</Button>
            <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Not now</button>
          </>
        )}
      </div>
    </div>
  );
}
