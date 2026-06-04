import React, { useEffect, useState } from 'react';
import { Users, Copy, Check, UserPlus, Flame, TrendingUp, X, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface BuddyInfo {
  id: string;
  name: string;
  streak: number;
  longestStreak: number;
  totalActive: number;
  missedDays: number;
  monthlyRate: number;
}

export function BuddyPage() {
  const { user, profile } = useAuth();
  const [buddy, setBuddy] = useState<BuddyInfo | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ id: string; name: string; requesterId: string } | null>(null);
  const [myStreak, setMyStreak] = useState({ current: 0, longest: 0, totalActive: 0, missedDays: 0, monthlyRate: 0 });
  const [copied, setCopied] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [loading, setLoading] = useState(true);

  const inviteLink = profile?.invite_code
    ? `${window.location.origin}/join/${profile.invite_code}`
    : '';

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);

    const [streakRes, buddyRel] = await Promise.all([
      supabase.from('streaks').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('buddies')
        .select('*')
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .not('status', 'eq', 'declined')
        .maybeSingle(),
    ]);

    if (streakRes.data) {
      setMyStreak({
        current: streakRes.data.current_streak,
        longest: streakRes.data.longest_streak,
        totalActive: streakRes.data.total_active_days,
        missedDays: streakRes.data.total_missed_days,
        monthlyRate: Math.round((streakRes.data.monthly_completion_rate ?? 0) * 100),
      });
    }

    if (buddyRel.data) {
      if (buddyRel.data.status === 'pending' && buddyRel.data.recipient_id === user.id) {
        // Incoming request
        const { data: requesterProfile } = await supabase.from('profiles').select('display_name').eq('id', buddyRel.data.requester_id).maybeSingle();
        setPendingRequest({ id: buddyRel.data.id, name: requesterProfile?.display_name ?? 'Someone', requesterId: buddyRel.data.requester_id });
      } else if (buddyRel.data.status === 'active') {
        const buddyId = buddyRel.data.requester_id === user.id ? buddyRel.data.recipient_id : buddyRel.data.requester_id;
        const [buddyProfile, buddyStreak] = await Promise.all([
          supabase.from('profiles').select('display_name').eq('id', buddyId).maybeSingle(),
          supabase.from('streaks').select('*').eq('user_id', buddyId).maybeSingle(),
        ]);
        if (buddyProfile.data && buddyStreak.data) {
          setBuddy({
            id: buddyId,
            name: buddyProfile.data.display_name,
            streak: buddyStreak.data.current_streak,
            longestStreak: buddyStreak.data.longest_streak,
            totalActive: buddyStreak.data.total_active_days,
            missedDays: buddyStreak.data.total_missed_days,
            monthlyRate: Math.round((buddyStreak.data.monthly_completion_rate ?? 0) * 100),
          });
        }
      }
    }

    setLoading(false);
  }

  function copyInvite() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function connectByCode() {
    if (!user || !inviteInput.trim()) return;
    setConnectLoading(true);
    setConnectError('');
    const code = inviteInput.trim().toUpperCase();
    const { data: targetProfile } = await supabase.from('profiles').select('id').eq('invite_code', code).maybeSingle();
    if (!targetProfile) { setConnectError('Invite code not found.'); setConnectLoading(false); return; }
    if (targetProfile.id === user.id) { setConnectError("You can't buddy with yourself."); setConnectLoading(false); return; }
    const { error } = await supabase.from('buddies').insert({ requester_id: user.id, recipient_id: targetProfile.id });
    if (error) { setConnectError('Could not send request. You may already have a buddy.'); }
    else { setInviteInput(''); await loadData(); }
    setConnectLoading(false);
  }

  async function acceptRequest() {
    if (!pendingRequest) return;
    await supabase.from('buddies').update({ status: 'active' }).eq('id', pendingRequest.id);
    setPendingRequest(null);
    await loadData();
  }

  async function declineRequest() {
    if (!pendingRequest) return;
    await supabase.from('buddies').update({ status: 'declined' }).eq('id', pendingRequest.id);
    setPendingRequest(null);
  }

  async function removeBuddy() {
    if (!user || !buddy) return;
    await supabase.from('buddies')
      .update({ status: 'declined' })
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);
    setBuddy(null);
  }

  const myScore = myStreak.current * 10 + myStreak.totalActive;
  const buddyScore = buddy ? buddy.streak * 10 + buddy.totalActive : 0;
  const winning = myScore > buddyScore;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 lg:pb-8">
      <h1 className="text-xl font-bold text-white">Buddy System</h1>

      {/* Pending request */}
      {pendingRequest && (
        <Card className="border-emerald-500/30">
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-white mb-1">{pendingRequest.name} wants to be your buddy!</p>
            <p className="text-xs text-gray-500 mb-3">Accept to see each other's streaks and compete.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={acceptRequest}>Accept</Button>
              <Button size="sm" variant="secondary" onClick={declineRequest}>Decline</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Head-to-head if buddy exists */}
      {buddy && (
        <>
          <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Head to Head</p>
              {winning ? (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">You're leading!</span>
              ) : myScore === buddyScore ? (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">Tied</span>
              ) : (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">You're behind — catch up!</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-lg font-bold text-emerald-400">{profile?.display_name?.[0]?.toUpperCase()}</span>
                </div>
                <p className="text-sm font-semibold text-white">{profile?.display_name}</p>
                <p className="text-xs text-gray-500">You</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-lg font-bold text-blue-400">{buddy.name[0]?.toUpperCase()}</span>
                </div>
                <p className="text-sm font-semibold text-white">{buddy.name}</p>
                <p className="text-xs text-gray-500">Buddy</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Current streak', myVal: `${myStreak.current}d`, buddyVal: `${buddy.streak}d`, myWins: myStreak.current >= buddy.streak },
              { label: 'Longest streak', myVal: `${myStreak.longest}d`, buddyVal: `${buddy.longestStreak}d`, myWins: myStreak.longest >= buddy.longestStreak },
              { label: 'Active days', myVal: myStreak.totalActive, buddyVal: buddy.totalActive, myWins: myStreak.totalActive >= buddy.totalActive },
              { label: 'Missed days', myVal: myStreak.missedDays, buddyVal: buddy.missedDays, myWins: myStreak.missedDays <= buddy.missedDays },
            ].map(stat => (
              <Card key={stat.label} className="p-4">
                <p className="text-xs text-gray-500 mb-2">{stat.label}</p>
                <div className="flex items-center justify-between">
                  <span className={`text-lg font-bold ${stat.myWins ? 'text-emerald-400' : 'text-white'}`}>{stat.myVal}</span>
                  <span className="text-xs text-gray-600">vs</span>
                  <span className={`text-lg font-bold ${!stat.myWins ? 'text-red-400' : 'text-white'}`}>{stat.buddyVal}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Shame box for behind */}
          {!winning && myScore !== buddyScore && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center">
              <p className="text-red-400 font-bold text-sm uppercase tracking-wide">YOU ARE LOSING.</p>
              <p className="text-red-300/70 text-xs mt-1">
                {buddy.name} is {buddyScore - myScore} points ahead. Stop making excuses and get moving. Right now.
              </p>
            </div>
          )}

          {/* Achievement badges */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">Milestones</h2>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '7-day streak', unlocked: myStreak.longest >= 7 },
                  { label: '30-day streak', unlocked: myStreak.longest >= 30 },
                  { label: '10 active days', unlocked: myStreak.totalActive >= 10 },
                  { label: '50 active days', unlocked: myStreak.totalActive >= 50 },
                  { label: 'Zero miss week', unlocked: myStreak.monthlyRate >= 90 },
                ].map(badge => (
                  <span key={badge.label} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
                    badge.unlocked ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' : 'bg-gray-800 border-gray-700 text-gray-600'
                  }`}>
                    {badge.unlocked ? '🏆 ' : '🔒 '}{badge.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <button onClick={removeBuddy} className="text-xs text-gray-600 hover:text-red-400 flex items-center gap-1 transition-colors">
            <X className="w-3 h-3" /> Remove buddy
          </button>
        </>
      )}

      {/* No buddy yet */}
      {!buddy && !pendingRequest && (
        <>
          <Card>
            <CardContent className="py-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Invite your buddy</p>
                  <p className="text-xs text-gray-500">Share your invite link — they join and you're paired</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5">
                <span className="text-xs text-gray-400 flex-1 truncate">{inviteLink}</span>
                <button onClick={copyInvite} className="text-gray-500 hover:text-emerald-400 transition-colors flex-shrink-0">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">Your code: <span className="text-gray-400 font-mono font-semibold">{profile?.invite_code}</span></p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Enter a buddy's code</p>
                  <p className="text-xs text-gray-500">Got a buddy's invite code? Enter it here.</p>
                </div>
              </div>
              {connectError && <p className="text-xs text-red-400 mb-2">{connectError}</p>}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteInput}
                  onChange={e => setInviteInput(e.target.value.toUpperCase())}
                  placeholder="e.g. AB12CD34"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  maxLength={8}
                />
                <Button size="sm" onClick={connectByCode} loading={connectLoading} disabled={inviteInput.length !== 8}>
                  Connect
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* My stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">My Stats</h2>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-white">{myStreak.current}</p>
              <p className="text-xs text-gray-500">Current streak</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-white">{myStreak.longest}</p>
              <p className="text-xs text-gray-500">Longest streak</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{myStreak.totalActive}</p>
              <p className="text-xs text-gray-500">Total active days</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${myStreak.missedDays > 10 ? 'text-red-400' : 'text-white'}`}>{myStreak.missedDays}</p>
              <p className="text-xs text-gray-500">Days missed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
