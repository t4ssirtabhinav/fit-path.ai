import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Copy, Check, UserPlus, Flame, TrendingUp, X, Award, Dumbbell, Zap, Moon, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_TIMEZONE } from '../lib/utils';
import { DailyTaskRepository } from '../repositories/DailyTaskRepository';
import { StreakRepository } from '../repositories/StreakRepository';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { BuddyDetail, DailyTask, TaskLog } from '../types';

export function BuddyPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedBuddyId = searchParams.get('buddyId');

  const [buddies, setBuddies] = useState<BuddyDetail[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ id: string; name: string; requesterId: string }[]>([]);
  const [myStreak, setMyStreak] = useState({ current: 0, longest: 0, totalActive: 0, missedDays: 0, monthlyRate: 0 });
  const [copied, setCopied] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [loading, setLoading] = useState(true);

  // Detail view state
  const [expandedBuddyId, setExpandedBuddyId] = useState<string | null>(selectedBuddyId);
  const [buddyTasks, setBuddyTasks] = useState<DailyTask[]>([]);
  const [buddyLogs, setBuddyLogs] = useState<TaskLog[]>([]);

  const inviteLink = profile?.invite_code
    ? `${window.location.origin}/join/${profile.invite_code}`
    : '';

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  useEffect(() => {
    if (selectedBuddyId) setExpandedBuddyId(selectedBuddyId);
  }, [selectedBuddyId]);

  useEffect(() => {
    if (expandedBuddyId) loadBuddyDetail(expandedBuddyId);
  }, [expandedBuddyId]);

  async function loadData() {
    if (!user) return;
    setLoading(true);

    const [myStreakData, buddyRels] = await Promise.all([
      StreakRepository.getForUser(user.id),
      supabase.from('buddies')
        .select('*')
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .neq('status', 'declined'),
    ]);

    if (myStreakData) {
      setMyStreak({
        current: myStreakData.current_streak,
        longest: myStreakData.longest_streak,
        totalActive: myStreakData.total_active_days,
        missedDays: myStreakData.total_missed_days,
        monthlyRate: Math.round((myStreakData.monthly_completion_rate ?? 0) * 100),
      });
    }

    // Separate pending incoming requests from active buddies
    const pending: typeof pendingRequests = [];
    const activeBuddyIds: string[] = [];

    for (const rel of buddyRels.data ?? []) {
      if (rel.status === 'pending' && rel.recipient_id === user.id) {
        const { data: requesterProfile } = await supabase.from('profiles').select('display_name').eq('id', rel.requester_id).maybeSingle();
        pending.push({ id: rel.id, name: requesterProfile?.display_name ?? 'Someone', requesterId: rel.requester_id });
      } else if (rel.status === 'active') {
        const buddyId = rel.requester_id === user.id ? rel.recipient_id : rel.requester_id;
        activeBuddyIds.push(buddyId);
      }
    }
    setPendingRequests(pending);

    // Load active buddy details
    if (activeBuddyIds.length > 0) {
      const [buddyProfiles, buddyStreaks] = await Promise.all([
        supabase.from('profiles').select('id, display_name').in('id', activeBuddyIds),
        StreakRepository.getForUsers(activeBuddyIds),
      ]);
      const streakMap = new Map(buddyStreaks.map(s => [s.user_id, s]));
      const details: BuddyDetail[] = (buddyProfiles.data ?? []).map(p => {
        const s = streakMap.get(p.id);
        return {
          id: p.id,
          name: p.display_name,
          streak: s?.current_streak ?? 0,
          longestStreak: s?.longest_streak ?? 0,
          totalActive: s?.total_active_days ?? 0,
          missedDays: s?.total_missed_days ?? 0,
          monthlyRate: Math.round((s?.monthly_completion_rate ?? 0) * 100),
          completionPct: Math.round((s?.monthly_completion_rate ?? 0) * 100),
          buddyRelId: '',
        };
      });
      setBuddies(details);
    }

    setLoading(false);
  }

  async function loadBuddyDetail(buddyId: string) {
    // Use the buddy's own timezone — their tasks were seeded against their "today", not ours
    const { data: buddyProfile } = await supabase.from('profiles').select('timezone').eq('id', buddyId).maybeSingle();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: buddyProfile?.timezone || DEFAULT_TIMEZONE });
    const [tasksData, logsData] = await Promise.all([
      DailyTaskRepository.getForDate(buddyId, today, ['workout', 'habit', 'sleep']),
      DailyTaskRepository.getLogsForDate(buddyId, today),
    ]);
    setBuddyTasks(tasksData);
    setBuddyLogs(logsData);
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
    // Use SECURITY DEFINER function for safe invite code lookup
    const { data: targetProfile, error: rpcError } = await supabase.rpc('lookup_profile_by_invite_code', { code });
    if (rpcError || !targetProfile || targetProfile.length === 0) { setConnectError('Invite code not found.'); setConnectLoading(false); return; }
    const targetId = targetProfile[0].id;
    if (targetId === user.id) { setConnectError("You can't buddy with yourself."); setConnectLoading(false); return; }
    // Check for existing pending or active connection
    const { data: existing } = await supabase.from('buddies')
      .select('id')
      .eq('requester_id', user.id)
      .eq('recipient_id', targetId)
      .in('status', ['pending', 'active'])
      .maybeSingle();
    if (existing) { setConnectError('You already have a pending or active connection with this person.'); setConnectLoading(false); return; }
    const { data: reverseExisting } = await supabase.from('buddies')
      .select('id')
      .eq('requester_id', targetId)
      .eq('recipient_id', user.id)
      .in('status', ['pending', 'active'])
      .maybeSingle();
    if (reverseExisting) { setConnectError('You already have a pending or active connection with this person.'); setConnectLoading(false); return; }
    const { error } = await supabase.from('buddies').insert({ requester_id: user.id, recipient_id: targetId });
    if (error) {
      setConnectError(error.code === '23505'
        ? 'You already have a pending or active connection with this person.'
        : 'Could not send request. Please try again.');
    } else {
      setInviteInput('');
      await loadData();
    }
    setConnectLoading(false);
  }

  async function acceptRequest(req: typeof pendingRequests[0]) {
    await supabase.from('buddies').update({ status: 'active' }).eq('id', req.id);
    setPendingRequests(prev => prev.filter(p => p.id !== req.id));
    await loadData();
  }

  async function declineRequest(req: typeof pendingRequests[0]) {
    await supabase.from('buddies').update({ status: 'declined' }).eq('id', req.id);
    setPendingRequests(prev => prev.filter(p => p.id !== req.id));
  }

  async function removeBuddy(buddyId: string) {
    if (!user) return;
    await supabase.from('buddies')
      .update({ status: 'declined' })
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .eq('status', 'active');
    // Also filter by the specific buddy
    await supabase.from('buddies')
      .update({ status: 'declined' })
      .or(`requester_id.eq.${buddyId},recipient_id.eq.${buddyId}`)
      .eq('status', 'active');
    setBuddies(prev => prev.filter(b => b.id !== buddyId));
    setExpandedBuddyId(null);
  }

  const myScore = myStreak.current * 10 + myStreak.totalActive;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 lg:pb-8">
      <h1 className="text-xl font-bold text-white">Buddy System</h1>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <Card className="border-emerald-500/30">
          <CardContent className="py-4 space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{req.name} wants to be your buddy!</p>
                  <p className="text-xs text-gray-500">Accept to see each other's streaks and compete.</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => acceptRequest(req)}>Accept</Button>
                  <Button size="sm" variant="secondary" onClick={() => declineRequest(req)}>Decline</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add new buddy */}
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Add a new buddy</p>
              <p className="text-xs text-gray-500">Share your invite link or enter their code</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 mb-3">
            <span className="text-xs text-gray-400 flex-1 truncate">{inviteLink}</span>
            <button onClick={copyInvite} className="text-gray-500 hover:text-emerald-400 transition-colors flex-shrink-0">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-600 mb-3">Your code: <span className="text-gray-400 font-mono font-semibold">{profile?.invite_code}</span></p>
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
              <UserPlus className="w-4 h-4" />
              Connect
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Buddy cards */}
      {buddies.length > 0 ? (
        buddies.map(buddy => {
          const buddyScore = buddy.streak * 10 + buddy.totalActive;
          const winning = myScore > buddyScore;
          const isExpanded = expandedBuddyId === buddy.id;
          const isPositive = buddy.completionPct >= 50;

          return (
            <Card key={buddy.id}>
              <CardHeader>
                <button
                  className="w-full flex items-center justify-between"
                  onClick={() => setExpandedBuddyId(isExpanded ? null : buddy.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold text-blue-400">{buddy.name[0]?.toUpperCase()}</span>
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">{buddy.name}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>{buddy.completionPct}% this month</span>
                        <span className="text-orange-400 flex items-center gap-0.5"><Flame className="w-3 h-3" />{buddy.streak}d</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {winning ? (
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">You lead</span>
                    ) : myScore === buddyScore ? (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">Tied</span>
                    ) : (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">Behind</span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </button>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-3">
                  {/* Head to head stats */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Current streak', myVal: `${myStreak.current}d`, buddyVal: `${buddy.streak}d`, myWins: myStreak.current >= buddy.streak },
                      { label: 'Longest streak', myVal: `${myStreak.longest}d`, buddyVal: `${buddy.longestStreak}d`, myWins: myStreak.longest >= buddy.longestStreak },
                      { label: 'Active days', myVal: myStreak.totalActive, buddyVal: buddy.totalActive, myWins: myStreak.totalActive >= buddy.totalActive },
                      { label: 'Missed days', myVal: myStreak.missedDays, buddyVal: buddy.missedDays, myWins: myStreak.missedDays <= buddy.missedDays },
                    ].map(stat => (
                      <div key={stat.label} className="bg-gray-800/50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                        <div className="flex items-center justify-between">
                          <span className={`text-lg font-bold ${stat.myWins ? 'text-emerald-400' : 'text-white'}`}>{stat.myVal}</span>
                          <span className="text-xs text-gray-600">vs</span>
                          <span className={`text-lg font-bold ${!stat.myWins ? 'text-red-400' : 'text-white'}`}>{stat.buddyVal}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Buddy's today tasks (workout/habit/sleep only) */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Today's activity</p>
                    {buddyTasks.length > 0 ? buddyTasks.map(task => {
                      const log = buddyLogs.find(l => l.task_id === task.id);
                      const icon = task.category === 'workout' ? <Dumbbell className="w-3 h-3" /> : task.category === 'sleep' ? <Moon className="w-3 h-3" /> : <Zap className="w-3 h-3" />;
                      return (
                        <div key={task.id} className="flex items-center gap-2 py-1.5 text-xs">
                          <span className={log?.completed ? 'text-emerald-400' : 'text-gray-600'}>{icon}</span>
                          <span className={log?.completed ? 'text-gray-300 line-through' : 'text-gray-400'}>{task.title}</span>
                        </div>
                      );
                    }) : (
                      <p className="text-xs text-gray-600">No tasks visible for today</p>
                    )}
                  </div>

                  {/* Shame box */}
                  {!winning && myScore !== buddyScore && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
                      <p className="text-red-400 font-bold text-xs uppercase tracking-wide">YOU ARE LOSING.</p>
                      <p className="text-red-300/70 text-xs mt-1">
                        {buddy.name} is {buddyScore - myScore} points ahead. Stop making excuses.
                      </p>
                    </div>
                  )}

                  <button onClick={() => removeBuddy(buddy.id)} className="text-xs text-gray-600 hover:text-red-400 flex items-center gap-1 transition-colors">
                    <X className="w-3 h-3" /> Remove buddy
                  </button>
                </CardContent>
              )}
            </Card>
          );
        })
      ) : (
        <Card className="p-8 text-center">
          <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">No buddies yet</p>
          <p className="text-gray-500 text-sm">Add a buddy to start competing and stay accountable.</p>
        </Card>
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

      {/* Milestones */}
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
    </div>
  );
}
