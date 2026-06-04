import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Flame, Dumbbell, Salad, Pill, CheckCircle2, Circle, Coffee,
  Moon, Zap, ChevronRight, RefreshCw, BedDouble, Target, TrendingUp, Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { today } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import type { DailyTask, TaskLog, Streak } from '../types';

type TaskWithLog = DailyTask & { log?: TaskLog };

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  workout: <Dumbbell className="w-4 h-4" />,
  meal: <Salad className="w-4 h-4" />,
  supplement: <Pill className="w-4 h-4" />,
  habit: <Zap className="w-4 h-4" />,
  sleep: <Moon className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  workout: 'text-blue-400 bg-blue-400/10',
  meal: 'text-green-400 bg-green-400/10',
  supplement: 'text-amber-400 bg-amber-400/10',
  habit: 'text-sky-400 bg-sky-400/10',
  sleep: 'text-violet-400 bg-violet-400/10',
};

function CompletionRing({ percent }: { percent: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width="90" height="90" className="-rotate-90">
      <circle cx="45" cy="45" r={r} strokeWidth="6" stroke="#1f2937" fill="none" />
      <circle
        cx="45" cy="45" r={r} strokeWidth="6"
        stroke={percent >= 80 ? '#10b981' : percent >= 50 ? '#f59e0b' : '#ef4444'}
        fill="none" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        className="transition-all duration-700"
      />
    </svg>
  );
}

export function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskWithLog[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [buddyData, setBuddyData] = useState<{ name: string; streak: number; completion: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [restDayLogging, setRestDayLogging] = useState(false);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  const todayDate = today();
  const dateLabel = format(new Date(), 'EEEE, MMMM d');

  const completedCount = tasks.filter(t => t.log?.completed).length;
  const totalCount = tasks.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [tasksRes, logsRes, streakRes] = await Promise.all([
      supabase.from('daily_tasks').select('*').eq('user_id', user.id).eq('task_date', todayDate).order('order_index'),
      supabase.from('task_logs').select('*').eq('user_id', user.id).eq('log_date', todayDate),
      supabase.from('streaks').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    const logMap = new Map((logsRes.data ?? []).map(l => [l.task_id, l]));
    const enriched = (tasksRes.data ?? []).map(t => ({ ...t, log: logMap.get(t.id) }));
    setTasks(enriched);
    setStreak(streakRes.data);

    // If no tasks today, try to seed from active plan
    if (enriched.length === 0) {
      const { data: plan } = await supabase.from('plans').select('id, plan_data').eq('user_id', user.id).eq('is_active', true).maybeSingle();
      if (plan) {
        await seedTasksFromPlan(user.id, plan.id, plan.plan_data as Record<string, unknown>);
        const { data: newTasks } = await supabase.from('daily_tasks').select('*').eq('user_id', user.id).eq('task_date', todayDate).order('order_index');
        setTasks((newTasks ?? []).map(t => ({ ...t, log: undefined })));
      }
    }

    // Fetch buddy
    const { data: buddyRel } = await supabase
      .from('buddies')
      .select('requester_id, recipient_id')
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .eq('status', 'active')
      .maybeSingle();

    if (buddyRel) {
      const buddyId = buddyRel.requester_id === user.id ? buddyRel.recipient_id : buddyRel.requester_id;
      const [buddyProfile, buddyStreak] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', buddyId).maybeSingle(),
        supabase.from('streaks').select('current_streak, monthly_completion_rate').eq('user_id', buddyId).maybeSingle(),
      ]);
      if (buddyProfile.data && buddyStreak.data) {
        setBuddyData({
          name: buddyProfile.data.display_name,
          streak: buddyStreak.data.current_streak,
          completion: Math.round((buddyStreak.data.monthly_completion_rate ?? 0) * 100),
        });
      }
    }

    setLoading(false);
  }, [user, todayDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function toggleTask(task: TaskWithLog) {
    if (!user || togglingId) return;
    setTogglingId(task.id);
    const nowCompleted = !task.log?.completed;

    setTasks(prev => prev.map(t =>
      t.id === task.id
        ? { ...t, log: { ...(t.log as TaskLog), completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null } as TaskLog }
        : t
    ));

    await supabase.from('task_logs').upsert({
      user_id: user.id,
      task_id: task.id,
      log_date: todayDate,
      completed: nowCompleted,
      completed_at: nowCompleted ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,task_id,log_date' });

    await updateStreak(user.id, nowCompleted);
    setTogglingId(null);
  }

  async function updateStreak(userId: string, completedAny: boolean) {
    const { data: current } = await supabase.from('streaks').select('*').eq('user_id', userId).maybeSingle();
    if (!current) return;

    const lastActive = current.last_active_date;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yest = yesterday.toISOString().split('T')[0];

    let newStreak = current.current_streak;
    if (completedAny && lastActive !== todayDate) {
      newStreak = lastActive === yest ? current.current_streak + 1 : 1;
    }

    await supabase.from('streaks').update({
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, current.longest_streak),
      last_active_date: completedAny ? todayDate : current.last_active_date,
      total_active_days: completedAny && lastActive !== todayDate ? current.total_active_days + 1 : current.total_active_days,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    setStreak(prev => prev ? { ...prev, current_streak: newStreak, longest_streak: Math.max(newStreak, prev.longest_streak) } : prev);
  }

  async function logRestDay() {
    if (!user) return;
    setRestDayLogging(true);
    for (const task of tasks.filter(t => !t.log?.completed)) {
      await supabase.from('task_logs').upsert({
        user_id: user.id,
        task_id: task.id,
        log_date: todayDate,
        completed: false,
        notes: 'Rest day',
      }, { onConflict: 'user_id,task_id,log_date' });
    }
    await fetchData();
    setRestDayLogging(false);
  }

  async function saveMeasurement() {
    if (!user || (!weight && !waist)) return;
    setSavingMeasurement(true);
    await supabase.from('body_measurements').insert({
      user_id: user.id,
      measured_at: todayDate,
      weight_kg: weight ? Number(weight) : null,
      waist_cm: waist ? Number(waist) : null,
    });
    setSavingMeasurement(false);
    setShowMeasurementModal(false);
    setWeight('');
    setWaist('');
  }

  const groupedTasks = tasks.reduce<Record<string, TaskWithLog[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  const isShameMode = completionPct < 40 && totalCount > 0 && completedCount > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Loading your day...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{dateLabel}</p>
          <h1 className="text-xl font-bold text-white">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            {profile?.display_name?.split(' ')[0] ?? 'there'}
          </h1>
        </div>
        <button
          onClick={() => setShowMeasurementModal(true)}
          className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 px-3 py-1.5 rounded-xl transition-colors"
        >
          <Target className="w-3.5 h-3.5" />
          Log weight
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center mb-1">
            <Flame className={`w-5 h-5 ${(streak?.current_streak ?? 0) > 0 ? 'text-orange-400' : 'text-gray-600'}`} />
          </div>
          <p className="text-2xl font-bold text-white">{streak?.current_streak ?? 0}</p>
          <p className="text-xs text-gray-500">Day streak</p>
        </Card>
        <Card className="p-4 text-center relative overflow-hidden">
          <div className="flex flex-col items-center">
            <div className="relative">
              <CompletionRing percent={completionPct} />
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                {completionPct}%
              </span>
            </div>
            <p className="text-xs text-gray-500 -mt-1">Today</p>
          </div>
        </Card>
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white">{streak?.longest_streak ?? 0}</p>
          <p className="text-xs text-gray-500">Best streak</p>
        </Card>
      </div>

      {/* Shame mode banner */}
      {isShameMode && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
          <p className="text-red-400 font-bold text-sm">YOU ARE FALLING BEHIND.</p>
          <p className="text-red-300/80 text-xs mt-1">
            Only {completedCount}/{totalCount} tasks done today. Your body doesn't care about excuses. Neither does your future self.
            {buddyData && ` ${buddyData.name} is at ${buddyData.completion}% this month.`}
          </p>
        </div>
      )}

      {/* Buddy card */}
      {buddyData && (
        <Card>
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{buddyData.name}</p>
                <p className="text-xs text-gray-500">Your buddy</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-white flex items-center gap-1 justify-end">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                {buddyData.streak} days
              </p>
              <p className="text-xs text-gray-500">{buddyData.completion}% this month</p>
            </div>
          </div>
        </Card>
      )}

      {/* Task groups */}
      {tasks.length === 0 ? (
        <Card className="p-8 text-center">
          <Coffee className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">No tasks for today yet</p>
          <p className="text-gray-500 text-sm mb-4">Generate your plan to get started</p>
          <Button onClick={() => navigate('/generate-plan')} size="sm">
            Generate plan
          </Button>
        </Card>
      ) : (
        Object.entries(groupedTasks).map(([category, catTasks]) => (
          <Card key={category}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${CATEGORY_COLORS[category]}`}>
                  {CATEGORY_ICONS[category]}
                </span>
                <h2 className="text-sm font-semibold text-white capitalize">{category}</h2>
                <span className="ml-auto text-xs text-gray-500">
                  {catTasks.filter(t => t.log?.completed).length}/{catTasks.length}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {catTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task)}
                  disabled={togglingId === task.id}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 text-left ${
                    task.log?.completed
                      ? 'bg-emerald-500/5 border-emerald-500/20 opacity-75'
                      : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {task.log?.completed
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      : <Circle className="w-5 h-5 text-gray-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${task.log?.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{task.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {/* Rest day + actions */}
      {tasks.length > 0 && (
        <div className="flex gap-3">
          <button
            onClick={logRestDay}
            disabled={restDayLogging}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm transition-colors"
          >
            <BedDouble className="w-4 h-4" />
            Log rest day
          </button>
          <button
            onClick={() => navigate('/plan')}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm transition-colors"
          >
            View full plan
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Measurement modal */}
      {showMeasurementModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-white mb-4">Log today's measurements</h3>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Weight (kg)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="e.g. 68.5"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Waist (cm)</label>
                <input
                  type="number"
                  value={waist}
                  onChange={e => setWaist(e.target.value)}
                  placeholder="e.g. 88"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowMeasurementModal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={saveMeasurement} loading={savingMeasurement}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function seedTasksFromPlan(userId: string, planId: string, planData: Record<string, unknown>) {
  const todayStr = new Date().toISOString().split('T')[0];
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  // Delete any stale tasks before seeding to prevent duplication
  await supabase.from('daily_tasks').delete().eq('user_id', userId).eq('task_date', todayStr);

  const tasks: Array<Record<string, unknown>> = [];
  let idx = 0;

  const schedule = (planData.weekly_schedule as Record<string, { is_rest_day: boolean; workout?: { name: string; exercises: Array<{ name: string; sets: number; reps: string }> } }>)?.[dayName];
  if (schedule) {
    if (schedule.is_rest_day) {
      tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'habit', title: 'Rest & Recovery Day', description: 'Light walk, stretching, or yoga. Let your muscles recover.', order_index: idx++, is_rest_day: true });
    } else if (schedule.workout) {
      tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'workout', title: schedule.workout.name, description: schedule.workout.exercises.map((e) => `${e.name}: ${e.sets}x${e.reps}`).join(' • '), order_index: idx++, is_rest_day: false });
    }
  }

  const meals = (planData.daily_meals as Record<string, { title: string; items: string[] }>) ?? {};
  for (const [key, meal] of Object.entries(meals)) {
    tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'meal', title: `${key.replace(/_/g, ' ')}: ${meal.title}`, description: meal.items.slice(0, 3).join(', '), order_index: idx++, is_rest_day: false });
  }

  const supplements = ((planData.supplements as Array<{ name: string; dosage: string; timing: string; phase_start: number }>) ?? []).filter(s => s.phase_start === 1).slice(0, 4);
  for (const s of supplements) {
    tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'supplement', title: s.name, description: `${s.dosage} — ${s.timing}`, order_index: idx++, is_rest_day: false });
  }

  const habits = ((planData.daily_habits as Array<{ title: string; description: string; timing: string }>) ?? []).slice(0, 5);
  for (const h of habits) {
    tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'habit', title: h.title, description: `${h.timing} — ${h.description}`, order_index: idx++, is_rest_day: false });
  }

  const sleep = planData.sleep_protocol as { target_bedtime: string; target_wake_time: string } | undefined;
  if (sleep) {
    tasks.push({ user_id: userId, plan_id: planId, task_date: todayStr, category: 'sleep', title: `Sleep by ${sleep.target_bedtime}`, description: `Wake at ${sleep.target_wake_time}`, order_index: idx++, is_rest_day: false });
  }

  if (tasks.length > 0) await supabase.from('daily_tasks').insert(tasks);
}
