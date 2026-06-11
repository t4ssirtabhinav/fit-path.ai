import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingDown, TrendingUp, Scale, Ruler, Calendar, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { DailyTaskRepository } from '../repositories/DailyTaskRepository';
import { BodyMeasurementRepository } from '../repositories/BodyMeasurementRepository';
import { DailyLogRepository } from '../repositories/DailyLogRepository';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, addDays } from 'date-fns';
import type { DailyLog } from '../types';

interface Measurement { measured_at: string; weight_kg: number | null; waist_cm: number | null; }
interface DayActivity { date: string; completed: number; total: number; pct: number; }

export function ProgressPage() {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [activity, setActivity] = useState<DayActivity[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [, setLoading] = useState(true);

  // Historical date view
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateLog, setDateLog] = useState<DailyLog | null>(null);
  const [dateTasks, setDateTasks] = useState<{ category: string; title: string; completed: boolean }[]>([]);

  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');

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

    const thirtyDaysAgo = subDays(new Date(), 90).toISOString().split('T')[0];
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const [measurements, tasksData, logsData] = await Promise.all([
      BodyMeasurementRepository.getSince(user.id, thirtyDaysAgo),
      DailyTaskRepository.getDatesInRange(user.id, monthStart, monthEnd),
      DailyTaskRepository.getLogsInRange(user.id, monthStart, monthEnd),
    ]);

    setMeasurements(measurements as Measurement[]);

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

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 lg:pb-8">
      <h1 className="text-xl font-bold text-white">Progress</h1>

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
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={measurements.filter(m => m.weight_kg).map(m => ({ date: format(parseISO(m.measured_at), 'MMM d'), weight: m.weight_kg }))}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                <Area type="monotone" dataKey="weight" stroke="#10b981" fill="url(#weightGrad)" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Weekly completion chart */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-white">Weekly completion rate</h2>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} formatter={(v: number | string | readonly (number | string)[] | undefined) => [`${Array.isArray(v) ? v[0] : (v ?? 0)}%`, 'Completion']} />
              <Bar dataKey="completion" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: daysInMonth[0].getDay() }, (_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {activity.map(day => {
              const date = parseISO(day.date);
              const isSelected = day.date === selectedDate;
              const isCurrentDay = day.date === format(new Date(), 'yyyy-MM-dd');
              const color = day.total === 0 ? 'bg-gray-800' :
                day.pct >= 80 ? 'bg-emerald-500' :
                day.pct >= 50 ? 'bg-amber-500' : 'bg-red-500/60';
              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  title={`${format(date, 'MMM d')}: ${day.completed}/${day.total} tasks`}
                  className={`aspect-square rounded-md ${color} ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : isCurrentDay ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-gray-900' : ''} flex items-center justify-center hover:opacity-80 transition-opacity`}
                >
                  <span className="text-xs text-white/60 font-medium">{format(date, 'd')}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> 80%+</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> 50-79%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/60 inline-block" /> &lt;50%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-800 inline-block" /> No data</span>
          </div>
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
    </div>
  );
}
