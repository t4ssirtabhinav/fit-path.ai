import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Flame, Dumbbell, Salad, Pill, CheckCircle2, Circle, Coffee,
  Moon, Zap, ChevronRight, ChevronDown, ChevronUp, RefreshCw, BedDouble, Target, TrendingUp,
  Info, X, MessageSquare, Plus, Minus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PlanRepository } from '../repositories/PlanRepository';
import { DailyTaskRepository } from '../repositories/DailyTaskRepository';
import { StreakRepository } from '../repositories/StreakRepository';
import { BodyMeasurementRepository } from '../repositories/BodyMeasurementRepository';
import { DailyLogRepository } from '../repositories/DailyLogRepository';
import { ExerciseLogRepository } from '../repositories/ExerciseLogRepository';
import { TrackingConfigRepository } from '../repositories/TrackingConfigRepository';
import { BuddyRepository } from '../repositories/BuddyRepository';
import { ProfileRepository } from '../repositories/ProfileRepository';
import { StreakService } from '../services/StreakService';
import { DashboardService } from '../services/DashboardService';
import { today, DEFAULT_TIMEZONE, getTodaysExercises, parseLeadingInt, getExerciseType, getTaskInputType } from '../lib/utils';
import { usePlan } from '../hooks/usePlan';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import type { DailyTask, TaskLog, Streak, DailyLog, ExerciseLog, ExerciseSet } from '../types';
import type { Json } from '../types/database';

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

interface BuddyTile {
  id: string;
  name: string;
  streak: number;
  completionPct: number;
}

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
  const tz = profile?.timezone || DEFAULT_TIMEZONE;
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskWithLog[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [buddies, setBuddies] = useState<BuddyTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [restDayLogging, setRestDayLogging] = useState(false);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  // Log comments modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [dailyLog, setDailyLog] = useState<Partial<DailyLog>>({});
  const [savingLog, setSavingLog] = useState(false);

  // Info popup for task descriptions
  const [infoTask, setInfoTask] = useState<TaskWithLog | null>(null);

  // Per-task inline logging
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, { value: string; notes: string }>>({});

  // Exercise set logging
  const { planData } = usePlan(user?.id);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [exerciseSets, setExerciseSets] = useState<Record<string, ExerciseSet[]>>({});
  const [exerciseDuration, setExerciseDuration] = useState<Record<string, { minutes: number; notes: string }>>({});

  const [todayDate, setTodayDate] = useState(() => today(tz));
  const dateLabel = format(new Date(), 'EEEE, MMMM d');

  // Refresh date after midnight in the user's timezone
  useEffect(() => {
    const interval = setInterval(() => {
      const current = today(tz);
      if (current !== todayDate) setTodayDate(current);
    }, 60_000);
    return () => clearInterval(interval);
  }, [todayDate, tz]);

  const completedCount = tasks.filter(t => t.log?.completed).length;
  const totalCount = tasks.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [tasksData, logsData, streakData, exerciseLogsData] = await Promise.all([
      DailyTaskRepository.getForDate(user.id, todayDate),
      DailyTaskRepository.getLogsForDate(user.id, todayDate),
      StreakRepository.getForUser(user.id),
      ExerciseLogRepository.getForDate(user.id, todayDate),
    ]);
    setExerciseLogs(exerciseLogsData);

    const logMap = new Map(logsData.map(l => [l.task_id, l]));
    const enriched = tasksData.map(t => ({ ...t, log: logMap.get(t.id) }));
    setTasks(enriched);
    setStreak(streakData);

    // If no tasks today, try to seed from active plan (or tracking config for track-only users)
    if (enriched.length === 0) {
      if (profile?.onboarding_path === 'track') {
        const trackingConfig = await TrackingConfigRepository.getForUser(user.id);
        if (trackingConfig && trackingConfig.selected_trackers.length > 0) {
          await DashboardService.seedTrackingTasks(user.id, trackingConfig.selected_trackers, tz);
          const newTasks = await DailyTaskRepository.getForDate(user.id, todayDate);
          setTasks(newTasks.map(t => ({ ...t, log: undefined })));
        }
      } else {
        const plan = await PlanRepository.getActivePlan(user.id);
        if (plan) {
          await DashboardService.seedTasksFromPlan(user.id, plan.id, plan.plan_data, tz);
          const newTasks = await DailyTaskRepository.getForDate(user.id, todayDate);
          setTasks(newTasks.map(t => ({ ...t, log: undefined })));
        }
      }
    }

    // Load buddy tiles
    const buddyRels = await BuddyRepository.getRelations(user.id);
    const activeBuddyRels = buddyRels.filter(b => b.status === 'active');

    if (activeBuddyRels.length > 0) {
      const buddyIds = activeBuddyRels.map(b => b.requester_id === user.id ? b.recipient_id : b.requester_id);
      const [buddyProfiles, buddyStreaks] = await Promise.all([
        ProfileRepository.getByIds(buddyIds),
        StreakRepository.getForUsers(buddyIds),
      ]);
      const streakMap = new Map(buddyStreaks.map(s => [s.user_id, s]));
      const tiles: BuddyTile[] = buddyProfiles.map(p => {
        const s = streakMap.get(p.id);
        return {
          id: p.id,
          name: p.display_name,
          streak: s?.current_streak ?? 0,
          completionPct: Math.round((s?.monthly_completion_rate ?? 0) * 100),
        };
      });
      setBuddies(tiles);
    }

    // Load today's daily log
    const existingLog = await DailyLogRepository.getForDate(user.id, todayDate);
    if (existingLog) setDailyLog(existingLog);

    setLoading(false);
  }, [user?.id, todayDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    setTaskDrafts(prev => {
      const next = { ...prev };
      for (const task of tasks) {
        if (next[task.id]) continue;
        next[task.id] = {
          value: task.log?.value_logged != null ? String(task.log.value_logged) : '',
          notes: task.log?.notes ?? '',
        };
      }
      return next;
    });
  }, [tasks]);

  const todaysExercises = getTodaysExercises(planData, tz);

  useEffect(() => {
    if (todaysExercises.length === 0) return;
    setExerciseSets(prev => {
      const next: Record<string, ExerciseSet[]> = {};
      for (const ex of todaysExercises) {
        if (getExerciseType(ex) !== 'reps_weight') continue;
        const existingLog = exerciseLogs.find(l => l.exercise_name === ex.name);
        if (existingLog) {
          next[ex.name] = existingLog.sets as unknown as ExerciseSet[];
        } else if (prev[ex.name]) {
          next[ex.name] = prev[ex.name];
        } else {
          next[ex.name] = Array.from({ length: ex.sets }, () => ({ reps: parseLeadingInt(ex.reps), weight: 0 }));
        }
      }
      return next;
    });
    setExerciseDuration(prev => {
      const next: Record<string, { minutes: number; notes: string }> = {};
      for (const ex of todaysExercises) {
        if (getExerciseType(ex) !== 'duration') continue;
        const existingLog = exerciseLogs.find(l => l.exercise_name === ex.name);
        if (existingLog) {
          next[ex.name] = { minutes: existingLog.duration_minutes ?? 0, notes: existingLog.notes ?? '' };
        } else if (prev[ex.name]) {
          next[ex.name] = prev[ex.name];
        } else {
          next[ex.name] = { minutes: 0, notes: '' };
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseLogs, planData]);

  async function persistExerciseSets(exerciseName: string, sets: ExerciseSet[]) {
    if (!user) return;
    await ExerciseLogRepository.upsert({
      user_id: user.id,
      task_date: todayDate,
      exercise_name: exerciseName,
      sets: sets as unknown as Json,
      source: 'plan',
    });
  }

  function addSet(exerciseName: string) {
    setExerciseSets(prev => {
      const current = prev[exerciseName] ?? [];
      const last = current[current.length - 1];
      const updated = [...current, last ? { ...last } : { reps: 0, weight: 0 }];
      void persistExerciseSets(exerciseName, updated);
      return { ...prev, [exerciseName]: updated };
    });
  }

  function removeSet(exerciseName: string, index: number) {
    setExerciseSets(prev => {
      const updated = (prev[exerciseName] ?? []).filter((_, i) => i !== index);
      void persistExerciseSets(exerciseName, updated);
      return { ...prev, [exerciseName]: updated };
    });
  }

  function updateSet(exerciseName: string, index: number, field: keyof ExerciseSet, value: number) {
    setExerciseSets(prev => ({
      ...prev,
      [exerciseName]: (prev[exerciseName] ?? []).map((s, i) => i === index ? { ...s, [field]: value } : s),
    }));
  }

  function handleSetBlur(exerciseName: string) {
    void persistExerciseSets(exerciseName, exerciseSets[exerciseName] ?? []);
  }

  async function persistExerciseDuration(exerciseName: string, duration: { minutes: number; notes: string }) {
    if (!user) return;
    await ExerciseLogRepository.upsert({
      user_id: user.id,
      task_date: todayDate,
      exercise_name: exerciseName,
      sets: [] as unknown as Json,
      duration_minutes: duration.minutes,
      notes: duration.notes || null,
      source: 'plan',
    });
  }

  function updateExerciseDuration(exerciseName: string, field: 'minutes' | 'notes', value: number | string) {
    setExerciseDuration(prev => ({
      ...prev,
      [exerciseName]: { ...(prev[exerciseName] ?? { minutes: 0, notes: '' }), [field]: value },
    }));
  }

  function handleDurationBlur(exerciseName: string) {
    void persistExerciseDuration(exerciseName, exerciseDuration[exerciseName] ?? { minutes: 0, notes: '' });
  }

  async function toggleTask(task: TaskWithLog) {
    if (!user || togglingId) return;
    setTogglingId(task.id);
    const nowCompleted = !task.log?.completed;

    setTasks(prev => prev.map(t =>
      t.id === task.id
        ? { ...t, log: { ...(t.log as TaskLog), completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null } as TaskLog }
        : t
    ));

    await DailyTaskRepository.upsertLog({
      user_id: user.id,
      task_id: task.id,
      log_date: todayDate,
      completed: nowCompleted,
      completed_at: nowCompleted ? new Date().toISOString() : null,
    });

    const updated = await StreakService.recordCompletion(user.id, nowCompleted, todayDate, tz);
    if (updated) setStreak(updated);
    setTogglingId(null);
  }

  async function saveTaskLog(task: TaskWithLog, fields: { value_logged?: number | null; notes?: string | null }) {
    if (!user) return;
    const completedAt = new Date().toISOString();

    await DailyTaskRepository.upsertLog({
      user_id: user.id,
      task_id: task.id,
      log_date: todayDate,
      completed: true,
      completed_at: completedAt,
      ...fields,
    });

    setTasks(prev => prev.map(t =>
      t.id === task.id
        ? { ...t, log: { ...(t.log as TaskLog), ...fields, completed: true, completed_at: completedAt } as TaskLog }
        : t
    ));

    const updated = await StreakService.recordCompletion(user.id, true, todayDate, tz);
    if (updated) setStreak(updated);
  }

  function updateTaskDraft(taskId: string, field: 'value' | 'notes', value: string) {
    setTaskDrafts(prev => ({
      ...prev,
      [taskId]: { ...(prev[taskId] ?? { value: '', notes: '' }), [field]: value },
    }));
  }

  function handleTaskNumericBlur(task: TaskWithLog) {
    const raw = taskDrafts[task.id]?.value ?? '';
    if (raw === '') return;
    void saveTaskLog(task, { value_logged: Number(raw) });
  }

  function handleTaskNotesBlur(task: TaskWithLog) {
    const notes = taskDrafts[task.id]?.notes ?? '';
    if (!notes) return;
    void saveTaskLog(task, { notes });
  }

  async function logRestDay() {
    if (!user) return;
    setRestDayLogging(true);
    const pending = tasks.filter(t => !t.log?.completed);
    if (pending.length > 0) {
      try {
        await DailyTaskRepository.upsertLogs(pending.map(task => ({
          user_id: user.id,
          task_id: task.id,
          log_date: todayDate,
          completed: false,
          notes: 'Rest day',
        })));
      } catch (error) {
        console.error('Failed to log rest day:', error);
        setRestDayLogging(false);
        return;
      }
    }
    await fetchData();
    setRestDayLogging(false);
  }

  async function saveMeasurement() {
    if (!user || (!weight && !waist)) return;
    setSavingMeasurement(true);
    await BodyMeasurementRepository.create({
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

  async function saveDailyLog() {
    if (!user) return;
    setSavingLog(true);
    await DailyLogRepository.upsert({
      user_id: user.id,
      log_date: todayDate,
      workout_comments: dailyLog.workout_comments || null,
      energy_level: dailyLog.energy_level || null,
      meal_comments: dailyLog.meal_comments || null,
      supplement_comments: dailyLog.supplement_comments || null,
      illness_comments: dailyLog.illness_comments || null,
      sleep_comments: dailyLog.sleep_comments || null,
      vitals_comments: dailyLog.vitals_comments || null,
      other_comments: dailyLog.other_comments || null,
    });
    setSavingLog(false);
    setShowLogModal(false);
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 bg-sky-400/10 hover:bg-sky-400/20 px-3 py-1.5 rounded-xl transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Log notes
          </button>
          <button
            onClick={() => setShowMeasurementModal(true)}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 px-3 py-1.5 rounded-xl transition-colors"
          >
            <Target className="w-3.5 h-3.5" />
            Log weight
          </button>
        </div>
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

      {/* Buddy tiles - horizontal scroll */}
      {buddies.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {buddies.map(b => {
            const isPositive = b.completionPct >= 50;
            return (
              <button
                key={b.id}
                onClick={() => navigate(`/buddy?buddyId=${b.id}`)}
                className="flex-shrink-0 flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-700 transition-colors"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-700 text-white font-semibold text-sm">
                    {b.name[0]?.toUpperCase()}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-gray-900 ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </div>
                <div className="text-left min-w-[80px]">
                  <p className="text-sm font-medium text-white truncate max-w-[100px]">{b.name}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>{b.completionPct}%</span>
                    <span className="text-orange-400 flex items-center gap-0.5"><Flame className="w-3 h-3" />{b.streak}d</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Shame mode banner */}
      {isShameMode && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
          <p className="text-red-400 font-bold text-sm">YOU ARE FALLING BEHIND.</p>
          <p className="text-red-300/80 text-xs mt-1">
            Only {completedCount}/{totalCount} tasks done today. Your body doesn't care about excuses. Neither does your future self.
            {buddies.length > 0 && ` ${buddies[0].name} is at ${buddies[0].completionPct}% this month.`}
          </p>
        </div>
      )}

      {/* Task groups */}
      {tasks.length === 0 ? (
        <Card className="p-8 text-center">
          <Coffee className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          {profile?.onboarding_path === 'track' ? (
            <>
              <p className="text-white font-semibold mb-1">Nothing logged today yet</p>
              <p className="text-gray-500 text-sm mb-4">Use the Log notes button above to record workouts, meals, or how you're feeling.</p>
              <Button variant="secondary" onClick={() => navigate('/profile')} size="sm">
                Update tracking setup
              </Button>
            </>
          ) : (
            <>
              <p className="text-white font-semibold mb-1">No tasks for today yet</p>
              <p className="text-gray-500 text-sm mb-4">Generate your plan to get started</p>
              <Button onClick={() => navigate('/generate-plan')} size="sm">
                Generate plan
              </Button>
            </>
          )}
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
              {catTasks.map(task => {
                const inputType = getTaskInputType(task);
                const isExpanded = expandedTaskId === task.id;
                const draft = taskDrafts[task.id] ?? { value: '', notes: '' };
                const showExerciseLogger = inputType === 'exercise' && task.category === 'workout' && todaysExercises.length > 0;

                return (
                  <div
                    key={task.id}
                    className={`rounded-xl border transition-all duration-200 ${
                      task.log?.completed
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="w-full flex items-start gap-3 p-3 text-left">
                      <button
                        onClick={() => toggleTask(task)}
                        disabled={togglingId === task.id}
                        className="flex-shrink-0 mt-0.5"
                      >
                        {task.log?.completed
                          ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          : <Circle className="w-5 h-5 text-gray-600" />
                        }
                      </button>
                      <button onClick={() => toggleTask(task)} disabled={togglingId === task.id} className="flex-1 min-w-0 text-left">
                        <p className={`text-sm font-medium leading-snug ${task.log?.completed ? 'line-through text-gray-500 opacity-75' : 'text-white'}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-1">{task.description}</p>
                        )}
                      </button>
                      {task.description && task.description.length > 50 && (
                        <button
                          onClick={() => setInfoTask(task)}
                          className="flex-shrink-0 mt-0.5 text-gray-600 hover:text-gray-300 transition-colors"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      )}
                      {inputType !== 'none' && (
                        <button
                          onClick={() => setExpandedTaskId(prev => prev === task.id ? null : task.id)}
                          className="flex-shrink-0 mt-0.5 text-gray-600 hover:text-gray-300 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3">
                        {inputType === 'numeric' && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={draft.value}
                              onChange={e => updateTaskDraft(task.id, 'value', e.target.value)}
                              onBlur={() => handleTaskNumericBlur(task)}
                              placeholder="0"
                              className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-xs text-gray-500">{task.unit}</span>
                          </div>
                        )}

                        {inputType === 'rating' && (
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(v => (
                              <button
                                key={v}
                                onClick={() => { updateTaskDraft(task.id, 'value', String(v)); void saveTaskLog(task, { value_logged: v }); }}
                                className={`w-10 h-10 rounded-xl text-sm font-bold border transition-all ${
                                  Number(draft.value) === v
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        )}

                        {inputType === 'notes' && (
                          <textarea
                            value={draft.notes}
                            onChange={e => updateTaskDraft(task.id, 'notes', e.target.value)}
                            onBlur={() => handleTaskNotesBlur(task)}
                            placeholder="Add a note..."
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] resize-y"
                          />
                        )}

                        {inputType === 'measurement' && (
                          <button
                            onClick={() => setShowMeasurementModal(true)}
                            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 px-3 py-1.5 rounded-xl transition-colors"
                          >
                            <Target className="w-3.5 h-3.5" />
                            Log weight
                          </button>
                        )}

                        {inputType === 'exercise' && !showExerciseLogger && (
                          <textarea
                            value={draft.notes}
                            onChange={e => updateTaskDraft(task.id, 'notes', e.target.value)}
                            onBlur={() => handleTaskNotesBlur(task)}
                            placeholder="How did this workout go?"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] resize-y"
                          />
                        )}

                        {showExerciseLogger && (
                          <div className="space-y-2">
                            {todaysExercises.map(ex => {
                              const exExpanded = expandedExercise === ex.name;
                              return (
                                <div key={ex.name} className="bg-gray-900/50 border border-gray-700/50 rounded-xl">
                                  <button
                                    onClick={() => setExpandedExercise(prev => prev === ex.name ? null : ex.name)}
                                    className="w-full flex items-center justify-between gap-2 p-2.5 text-left"
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-white">{ex.name}</p>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        Target: {ex.sets} x {ex.reps}
                                        {ex.intensity_guidance ? ` — ${ex.intensity_guidance}` : ''}
                                      </p>
                                    </div>
                                    {exExpanded ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                                  </button>

                                  {exExpanded && (
                                    <div className="px-2.5 pb-2.5">
                                      {getExerciseType(ex) === 'reps_weight' ? (
                                        <>
                                          <div className="space-y-1.5">
                                            {(exerciseSets[ex.name] ?? []).map((set, i) => (
                                              <div key={i} className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500 w-10">Set {i + 1}</span>
                                                <input
                                                  type="number"
                                                  value={set.reps}
                                                  onChange={e => updateSet(ex.name, i, 'reps', Number(e.target.value))}
                                                  onBlur={() => handleSetBlur(ex.name)}
                                                  placeholder="Reps"
                                                  className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                                <span className="text-xs text-gray-500">reps ×</span>
                                                <input
                                                  type="number"
                                                  value={set.weight}
                                                  onChange={e => updateSet(ex.name, i, 'weight', Number(e.target.value))}
                                                  onBlur={() => handleSetBlur(ex.name)}
                                                  placeholder="Weight"
                                                  className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                                <span className="text-xs text-gray-500">kg</span>
                                                <button
                                                  onClick={() => removeSet(ex.name, i)}
                                                  className="ml-auto text-gray-600 hover:text-red-400 transition-colors"
                                                >
                                                  <Minus className="w-4 h-4" />
                                                </button>
                                              </div>
                                            ))}
                                          </div>

                                          <button
                                            onClick={() => addSet(ex.name)}
                                            className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 mt-2 transition-colors"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add set
                                          </button>
                                        </>
                                      ) : (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">Duration completed</span>
                                            <input
                                              type="number"
                                              value={exerciseDuration[ex.name]?.minutes ?? 0}
                                              onChange={e => updateExerciseDuration(ex.name, 'minutes', Number(e.target.value))}
                                              onBlur={() => handleDurationBlur(ex.name)}
                                              className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                            <span className="text-xs text-gray-500">min</span>
                                          </div>
                                          <textarea
                                            value={exerciseDuration[ex.name]?.notes ?? ''}
                                            onChange={e => updateExerciseDuration(ex.name, 'notes', e.target.value)}
                                            onBlur={() => handleDurationBlur(ex.name)}
                                            placeholder="Notes (optional) — how it felt, any details worth remembering"
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px] resize-y"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* Info popup modal */}
      {infoTask && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setInfoTask(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">{infoTask.title}</h3>
              <button onClick={() => setInfoTask(null)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{infoTask.description}</p>
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={() => setInfoTask(null)} className="w-full">Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Log modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Log your notes</h3>
              <button onClick={() => setShowLogModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Workout comments</label>
                <textarea
                  value={dailyLog.workout_comments ?? ''}
                  onChange={e => setDailyLog(prev => ({ ...prev, workout_comments: e.target.value }))}
                  placeholder="How did your workout feel?"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] resize-y"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Energy level</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setDailyLog(prev => ({ ...prev, energy_level: prev.energy_level === v ? null : v }))}
                      className={`w-10 h-10 rounded-xl text-sm font-bold border transition-all ${
                        dailyLog.energy_level === v
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-1">1 = exhausted, 5 = energized</p>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Meal comments</label>
                <textarea
                  value={dailyLog.meal_comments ?? ''}
                  onChange={e => setDailyLog(prev => ({ ...prev, meal_comments: e.target.value }))}
                  placeholder="Any observations about meals today?"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] resize-y"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Supplement comments</label>
                <textarea
                  value={dailyLog.supplement_comments ?? ''}
                  onChange={e => setDailyLog(prev => ({ ...prev, supplement_comments: e.target.value }))}
                  placeholder="Did you take all supplements? Any reactions?"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] resize-y"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Illness / pain notes</label>
                <textarea
                  value={dailyLog.illness_comments ?? ''}
                  onChange={e => setDailyLog(prev => ({ ...prev, illness_comments: e.target.value }))}
                  placeholder="Any sickness, pain, or discomfort?"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] resize-y"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Sleep comments</label>
                <textarea
                  value={dailyLog.sleep_comments ?? ''}
                  onChange={e => setDailyLog(prev => ({ ...prev, sleep_comments: e.target.value }))}
                  placeholder="Sleep quality, late night, early wake?"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] resize-y"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Vitals</label>
                <textarea
                  value={dailyLog.vitals_comments ?? ''}
                  onChange={e => setDailyLog(prev => ({ ...prev, vitals_comments: e.target.value }))}
                  placeholder="Blood pressure, heart rate, blood sugar, etc."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] resize-y"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Other comments</label>
                <textarea
                  value={dailyLog.other_comments ?? ''}
                  onChange={e => setDailyLog(prev => ({ ...prev, other_comments: e.target.value }))}
                  placeholder="Anything else you want to note?"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] resize-y"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="secondary" className="flex-1" onClick={() => setShowLogModal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={saveDailyLog} loading={savingLog}>Save notes</Button>
            </div>
          </div>
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

