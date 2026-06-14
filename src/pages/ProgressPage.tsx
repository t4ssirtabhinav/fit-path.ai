import { useEffect, useMemo, useState } from 'react';
import { TrendingDown, TrendingUp, Scale, Ruler, Calendar, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useHealthProfile } from '../hooks/useHealthProfile';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { MetricChart } from '../components/charts/MetricChart';
import { DailyTaskRepository } from '../repositories/DailyTaskRepository';
import { BodyMeasurementRepository } from '../repositories/BodyMeasurementRepository';
import { DailyLogRepository } from '../repositories/DailyLogRepository';
import { ExerciseLogRepository } from '../repositories/ExerciseLogRepository';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, addDays } from 'date-fns';
import { today, DEFAULT_TIMEZONE, cn } from '../lib/utils';
import type { DailyLog, ExerciseLog, ExerciseSet } from '../types';

interface Measurement { measured_at: string; weight_kg: number | null; waist_cm: number | null; }
interface DayActivity { date: string; completed: number; total: number; pct: number; }

type Tab = 'overview' | 'strength' | 'cardio' | 'nutrition' | 'supplements';

const STRENGTH_MODALITIES = ['gym', 'home', 'physio'];
const CARDIO_MODALITIES = ['cardio', 'yoga'];

function isStrengthLog(log: ExerciseLog): boolean {
  return log.duration_minutes == null && Array.isArray(log.sets) && (log.sets as unknown[]).length > 0;
}

function isCardioLog(log: ExerciseLog): boolean {
  return log.duration_minutes != null;
}

function HeatmapCalendar({
  days, getColor, onSelect, selectedDate, todayDate, legend,
}: {
  days: { date: string; title: string }[];
  getColor: (date: string) => string;
  onSelect?: (date: string) => void;
  selectedDate?: string;
  todayDate?: string;
  legend: { color: string; label: string }[];
}) {
  return (
    <>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: parseISO(days[0].date).getDay() }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map(day => {
          const date = parseISO(day.date);
          const isSelected = day.date === selectedDate;
          const isCurrentDay = day.date === todayDate;
          const color = getColor(day.date);
          return (
            <button
              key={day.date}
              onClick={() => onSelect?.(day.date)}
              title={day.title}
              className={cn(
                'aspect-square rounded-md flex items-center justify-center transition-opacity',
                color,
                onSelect ? 'hover:opacity-80' : '',
                isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : isCurrentDay ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-gray-900' : ''
              )}
            >
              <span className="text-xs text-white/60 font-medium">{format(date, 'd')}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 flex-wrap">
        {legend.map((l, i) => (
          <span key={i} className="flex items-center gap-1"><span className={cn('w-3 h-3 rounded inline-block', l.color)} /> {l.label}</span>
        ))}
      </div>
    </>
  );
}

export function ProgressPage() {
  const { user, profile } = useAuth();
  const tz = profile?.timezone ?? DEFAULT_TIMEZONE;
  const { healthProfile } = useHealthProfile(user?.id);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [activity, setActivity] = useState<DayActivity[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Strength / cardio data
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string>('');

  // Nutrition / supplements data
  const [mealLogs, setMealLogs] = useState<{ log_date: string; completed: boolean }[]>([]);
  const [supplementLogs, setSupplementLogs] = useState<{ log_date: string; completed: boolean; title: string }[]>([]);

  // Historical date view
  const [selectedDate, setSelectedDate] = useState(today(tz));
  const [dateLog, setDateLog] = useState<DailyLog | null>(null);
  const [dateTasks, setDateTasks] = useState<{ category: string; title: string; completed: boolean }[]>([]);

  const isToday = selectedDate === today(tz);

  const modalities = healthProfile?.activity_modalities ?? [];
  const showStrength = modalities.some(m => STRENGTH_MODALITIES.includes(m));
  const showCardio = modalities.some(m => CARDIO_MODALITIES.includes(m));
  const showNutrition = modalities.includes('diet');
  const showSupplements = modalities.includes('supplements');

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, currentMonth]);

  useEffect(() => {
    if (!user) return;
    loadDateData();
  }, [user, selectedDate]);

  async function loadData() {
    if (!user) return;
    setLoading(true);

    const ninetyDaysAgo = subDays(new Date(), 90).toISOString().split('T')[0];
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const fourteenDaysAgo = format(subDays(new Date(), 13), 'yyyy-MM-dd');
    const todayStr = today(tz);

    const [measurements, tasksData, logsData, exLogs, meals, supplements] = await Promise.all([
      BodyMeasurementRepository.getSince(user.id, ninetyDaysAgo),
      DailyTaskRepository.getDatesInRange(user.id, monthStart, monthEnd),
      DailyTaskRepository.getLogsInRange(user.id, monthStart, monthEnd),
      ExerciseLogRepository.getSince(user.id, ninetyDaysAgo),
      DailyTaskRepository.getTaskLogsWithCategoryInRange(user.id, monthStart, monthEnd, ['meal']),
      DailyTaskRepository.getTaskLogsWithCategoryInRange(user.id, fourteenDaysAgo, todayStr, ['supplement']),
    ]);

    setMeasurements(measurements as Measurement[]);
    setExerciseLogs(exLogs);
    setMealLogs(meals);
    setSupplementLogs(supplements);

    const tasksByDate = new Map<string, number>();
    for (const t of tasksData) {
      tasksByDate.set(t.task_date, (tasksByDate.get(t.task_date) ?? 0) + 1);
    }
    const completedByDate = new Map<string, number>();
    for (const l of logsData) {
      if (l.completed) completedByDate.set(l.log_date, (completedByDate.get(l.log_date) ?? 0) + 1);
    }

    const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
    const activityData = days.map(d => {
      const key = format(d, 'yyyy-MM-dd');
      const total = tasksByDate.get(key) ?? 0;
      const completed = completedByDate.get(key) ?? 0;
      return { date: key, completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
    });
    setActivity(activityData);
    setLoading(false);
  }

  async function loadDateData() {
    if (!user) return;
    const [log, tasksData] = await Promise.all([
      DailyLogRepository.getForDate(user.id, selectedDate),
      DailyTaskRepository.getForDate(user.id, selectedDate),
    ]);
    setDateLog(log);

    if (tasksData.length > 0) {
      const logsData = await DailyTaskRepository.getLogsForDate(user.id, selectedDate);
      const logMap = new Map(logsData.map(l => [l.task_id, l.completed]));
      setDateTasks(tasksData.map(t => ({
        category: t.category,
        title: t.title,
        completed: logMap.get(t.id) ?? false,
      })));
    } else {
      setDateTasks([]);
    }
  }

  const latestWeight = measurements.filter(m => m.weight_kg).pop();
  const firstWeight = measurements.find(m => m.weight_kg);
  const weightChange = latestWeight?.weight_kg && firstWeight?.weight_kg
    ? Math.round((latestWeight.weight_kg - firstWeight.weight_kg) * 10) / 10
    : null;

  const weeklyActivity = Array.from({ length: 12 }, (_, i) => {
    const weekStart = subDays(new Date(), (11 - i) * 7 + 7);
    const weekEnd = subDays(new Date(), (11 - i) * 7);
    const weekDays = activity.filter(d => {
      const date = parseISO(d.date);
      return date >= weekStart && date <= weekEnd;
    });
    const avg = weekDays.length > 0 ? Math.round(weekDays.reduce((s, d) => s + d.pct, 0) / weekDays.length) : 0;
    return { week: `W${i + 1}`, completion: avg };
  });

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });

  const logSections = dateLog ? [
    { label: 'Workout', value: dateLog.workout_comments },
    { label: 'Energy level', value: dateLog.energy_level ? `${dateLog.energy_level}/5` : null },
    { label: 'Meals', value: dateLog.meal_comments },
    { label: 'Supplements', value: dateLog.supplement_comments },
    { label: 'Illness / pain', value: dateLog.illness_comments },
    { label: 'Sleep', value: dateLog.sleep_comments },
    { label: 'Vitals', value: dateLog.vitals_comments },
    { label: 'Other', value: dateLog.other_comments },
  ].filter(s => s.value) : [];

  // ---- Strength data ----
  const strengthLogs = useMemo(() => exerciseLogs.filter(isStrengthLog), [exerciseLogs]);

  const volumeOverTime = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const log of strengthLogs) {
      const sets = (log.sets as unknown as ExerciseSet[]) ?? [];
      const volume = sets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0);
      byDate.set(log.task_date, (byDate.get(log.task_date) ?? 0) + volume);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ label: format(parseISO(date), 'MMM d'), value: Math.round(value) }));
  }, [strengthLogs]);

  const exerciseNames = useMemo(() => {
    const names = new Set(strengthLogs.map(l => l.exercise_name));
    return Array.from(names).sort();
  }, [strengthLogs]);

  useEffect(() => {
    if (exerciseNames.length > 0 && !exerciseNames.includes(selectedExercise)) {
      setSelectedExercise(exerciseNames[0]);
    }
  }, [exerciseNames, selectedExercise]);

  const exerciseProgression = useMemo(() => {
    return strengthLogs
      .filter(l => l.exercise_name === selectedExercise)
      .sort((a, b) => a.task_date.localeCompare(b.task_date))
      .map(log => {
        const sets = (log.sets as unknown as ExerciseSet[]) ?? [];
        const topWeight = sets.reduce((max, s) => Math.max(max, s.weight || 0), 0);
        return { label: format(parseISO(log.task_date), 'MMM d'), value: topWeight };
      });
  }, [strengthLogs, selectedExercise]);

  // ---- Cardio / yoga data ----
  const cardioLogs = useMemo(() => exerciseLogs.filter(isCardioLog), [exerciseLogs]);

  const durationOverTime = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const log of cardioLogs) {
      byDate.set(log.task_date, (byDate.get(log.task_date) ?? 0) + (log.duration_minutes ?? 0));
    }
    const sorted = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([date, value], i) => {
      const windowStart = subDays(parseISO(date), 6);
      const window = sorted.filter(([d]) => {
        const dd = parseISO(d);
        return dd >= windowStart && dd <= parseISO(date);
      });
      const rollingAvg = window.reduce((s, [, v]) => s + v, 0) / window.length;
      return { label: format(parseISO(date), 'MMM d'), value, secondary: Math.round(rollingAvg * 10) / 10, _i: i };
    }).map(({ label, value, secondary }) => ({ label, value, secondary }));
  }, [cardioLogs]);

  const cardioNotes = useMemo(() => {
    return cardioLogs
      .filter(l => l.notes)
      .sort((a, b) => b.task_date.localeCompare(a.task_date))
      .map(l => ({ date: l.task_date, exercise: l.exercise_name, notes: l.notes as string }));
  }, [cardioLogs]);

  function weeklySessionFrequency(logs: ExerciseLog[]) {
    return Array.from({ length: 12 }, (_, i) => {
      const weekStart = subDays(new Date(), (11 - i) * 7 + 7);
      const weekEnd = subDays(new Date(), (11 - i) * 7);
      const dates = new Set(
        logs
          .filter(l => {
            const d = parseISO(l.task_date);
            return d >= weekStart && d <= weekEnd;
          })
          .map(l => l.task_date)
      );
      return { label: `W${i + 1}`, value: dates.size };
    });
  }

  const strengthSessionFrequency = useMemo(() => weeklySessionFrequency(strengthLogs), [strengthLogs]);
  const cardioSessionFrequency = useMemo(() => weeklySessionFrequency(cardioLogs), [cardioLogs]);

  // ---- Nutrition data ----
  const mealCompletionByDate = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const log of mealLogs) {
      if (log.completed) map.set(log.log_date, true);
      else if (!map.has(log.log_date)) map.set(log.log_date, false);
    }
    return map;
  }, [mealLogs]);

  // ---- Supplements data ----
  const supplementTitles = useMemo(() => {
    const titles = new Set(supplementLogs.map(l => l.title));
    return Array.from(titles).sort();
  }, [supplementLogs]);

  const last14Days = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => format(subDays(new Date(), 13 - i), 'yyyy-MM-dd'));
  }, []);

  const supplementCompletion = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const log of supplementLogs) {
      map.set(`${log.title}|${log.log_date}`, log.completed);
    }
    return map;
  }, [supplementLogs]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(showStrength ? [{ id: 'strength' as Tab, label: 'Strength' }] : []),
    ...(showCardio ? [{ id: 'cardio' as Tab, label: 'Cardio & Yoga' }] : []),
    ...(showNutrition ? [{ id: 'nutrition' as Tab, label: 'Nutrition' }] : []),
    ...(showSupplements ? [{ id: 'supplements' as Tab, label: 'Supplements' }] : []),
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 lg:pb-8">
      <h1 className="text-xl font-bold text-white">Progress</h1>

      {/* Tab row */}
      {TABS.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                activeTab === tab.id ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          {/* Weight / waist summary */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                <p className="text-xs text-gray-500">Current weight</p>
              </div>
              <p className="text-2xl font-bold text-white">{latestWeight?.weight_kg ?? '—'}<span className="text-sm text-gray-500 ml-1">kg</span></p>
              {weightChange !== null && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${weightChange < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {weightChange < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {weightChange > 0 ? '+' : ''}{weightChange} kg since start
                </p>
              )}
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Ruler className="w-4 h-4 text-blue-400" />
                <p className="text-xs text-gray-500">Latest waist</p>
              </div>
              <p className="text-2xl font-bold text-white">
                {measurements.filter(m => m.waist_cm).pop()?.waist_cm ?? '—'}
                <span className="text-sm text-gray-500 ml-1">cm</span>
              </p>
            </Card>
          </div>

          {/* Weight trend chart */}
          {measurements.filter(m => m.weight_kg).length > 1 && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-white">Weight trend (90 days)</h2>
              </CardHeader>
              <CardContent className="pt-0">
                <MetricChart
                  type="area"
                  height={180}
                  data={measurements.filter(m => m.weight_kg).map(m => ({ label: format(parseISO(m.measured_at), 'MMM d'), value: m.weight_kg as number }))}
                />
              </CardContent>
            </Card>
          )}

          {/* Weekly completion chart */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-white">Weekly completion rate</h2>
            </CardHeader>
            <CardContent className="pt-0">
              <MetricChart
                type="bar"
                height={160}
                unit="%"
                data={weeklyActivity.map(w => ({ label: w.week, value: w.completion }))}
              />
            </CardContent>
          </Card>

          {/* Activity heatmap calendar */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentMonth(d => subDays(startOfMonth(d), 1))} className="p-1 hover:bg-gray-800 rounded-lg transition-colors">
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <button onClick={() => setCurrentMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })} className="p-1 hover:bg-gray-800 rounded-lg transition-colors">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <p key={i} className="text-xs text-gray-600 text-center font-medium">{d}</p>
                ))}
              </div>
              <HeatmapCalendar
                days={activity.map(a => ({ date: a.date, title: `${format(parseISO(a.date), 'MMM d')}: ${a.completed}/${a.total} tasks` }))}
                selectedDate={selectedDate}
                todayDate={today(tz)}
                onSelect={setSelectedDate}
                getColor={(date) => {
                  const day = activity.find(a => a.date === date);
                  if (!day || day.total === 0) return 'bg-gray-800';
                  if (day.pct >= 80) return 'bg-emerald-500';
                  if (day.pct >= 50) return 'bg-amber-500';
                  return 'bg-red-500/60';
                }}
                legend={[
                  { color: 'bg-emerald-500', label: '80%+' },
                  { color: 'bg-amber-500', label: '50-79%' },
                  { color: 'bg-red-500/60', label: '<50%' },
                  { color: 'bg-gray-800', label: 'No data' },
                ]}
              />
            </CardContent>
          </Card>

          {/* Historical date view */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-white">
                    {isToday ? 'Today' : format(parseISO(selectedDate), 'EEEE, MMM d')}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                    className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                    disabled={isToday}
                    className="p-1 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Task checkins */}
              {dateTasks.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Task check-ins</p>
                  <div className="space-y-1.5">
                    {dateTasks.map((task, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center ${task.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-600'}`}>
                          {task.completed ? '✓' : '○'}
                        </span>
                        <span className={task.completed ? 'text-gray-400 line-through' : 'text-gray-500'}>{task.title}</span>
                        <span className="ml-auto text-gray-600 capitalize">{task.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-600">No tasks logged for this day</p>
              )}

              {/* Daily log comments */}
              {logSections.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" />
                    Logged notes
                  </p>
                  <div className="space-y-2">
                    {logSections.map((s, i) => (
                      <div key={i} className="bg-gray-800/50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
                        <p className="text-sm text-gray-300">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'strength' && (
        <>
          {strengthLogs.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-gray-400">No strength workouts logged yet. Log your sets on the Today page to see your progress here.</p>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-white">Training volume (90 days)</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Total reps × weight logged per day</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <MetricChart type="line" data={volumeOverTime} unit="kg" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-white">Exercise progression</h2>
                    <select
                      value={selectedExercise}
                      onChange={e => setSelectedExercise(e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {exerciseNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Top set weight per session (kg)</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <MetricChart type="line" data={exerciseProgression} unit="kg" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-white">Session frequency</h2>
                </CardHeader>
                <CardContent className="pt-0">
                  <MetricChart type="bar" height={160} data={strengthSessionFrequency} />
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {activeTab === 'cardio' && (
        <>
          {cardioLogs.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-gray-400">No cardio or yoga sessions logged yet. Log a session duration on the Today page to see your trends here.</p>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-white">Session duration (90 days)</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Minutes per session, with 7-day rolling average</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <MetricChart type="line" data={durationOverTime} unit="min" secondaryLabel="7-day avg" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-white">Session frequency</h2>
                </CardHeader>
                <CardContent className="pt-0">
                  <MetricChart type="bar" height={160} data={cardioSessionFrequency} />
                </CardContent>
              </Card>

              {cardioNotes.length > 0 && (
                <Card>
                  <CardHeader>
                    <h2 className="text-sm font-semibold text-white">Session notes</h2>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {cardioNotes.map((n, i) => (
                      <div key={i} className="bg-gray-800/50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-0.5">{format(parseISO(n.date), 'MMM d')} · {n.exercise}</p>
                        <p className="text-sm text-gray-300">{n.notes}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'nutrition' && (
        <>
          {mealLogs.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-gray-400">No meals logged yet. Check off meals on the Today page to see your consistency here.</p>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <h2 className="text-sm font-semibold text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentMonth(d => subDays(startOfMonth(d), 1))} className="p-1 hover:bg-gray-800 rounded-lg transition-colors">
                      <ChevronLeft className="w-4 h-4 text-gray-400" />
                    </button>
                    <button onClick={() => setCurrentMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })} className="p-1 hover:bg-gray-800 rounded-lg transition-colors">
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Days with at least one meal logged</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <p key={i} className="text-xs text-gray-600 text-center font-medium">{d}</p>
                  ))}
                </div>
                <HeatmapCalendar
                  days={daysInMonth.map(d => ({ date: format(d, 'yyyy-MM-dd'), title: format(d, 'MMM d') }))}
                  todayDate={today(tz)}
                  getColor={(date) => {
                    if (!mealCompletionByDate.has(date)) return 'bg-gray-800';
                    return mealCompletionByDate.get(date) ? 'bg-emerald-500' : 'bg-red-500/60';
                  }}
                  legend={[
                    { color: 'bg-emerald-500', label: 'Logged' },
                    { color: 'bg-red-500/60', label: 'Missed' },
                    { color: 'bg-gray-800', label: 'No data' },
                  ]}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === 'supplements' && (
        <>
          {supplementTitles.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-gray-400">No supplements logged yet. Check off supplements on the Today page to see your adherence here.</p>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-white">Supplement adherence (14 days)</h2>
              </CardHeader>
              <CardContent className="pt-0 overflow-x-auto">
                <div className="min-w-[480px]">
                  <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `120px repeat(${last14Days.length}, 1fr)` }}>
                    <div />
                    {last14Days.map(d => (
                      <p key={d} className="text-[10px] text-gray-600 text-center font-medium">{format(parseISO(d), 'd')}</p>
                    ))}
                  </div>
                  {supplementTitles.map(title => (
                    <div key={title} className="grid gap-1 mb-1 items-center" style={{ gridTemplateColumns: `120px repeat(${last14Days.length}, 1fr)` }}>
                      <p className="text-xs text-gray-400 truncate pr-2">{title}</p>
                      {last14Days.map(d => {
                        const taken = supplementCompletion.get(`${title}|${d}`);
                        return (
                          <div key={d} className={cn(
                            'aspect-square rounded-md flex items-center justify-center text-[10px]',
                            taken === true ? 'bg-emerald-500 text-white' : taken === false ? 'bg-red-500/60 text-white' : 'bg-gray-800 text-gray-600'
                          )}>
                            {taken === true ? '✓' : taken === false ? '·' : ''}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
