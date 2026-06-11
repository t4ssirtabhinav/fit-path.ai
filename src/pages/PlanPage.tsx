import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, Salad, Pill, Zap, Moon, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Clock, Target, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { WorkoutSession, Supplement } from '../types';
import { usePlan } from '../hooks/usePlan';

export function PlanPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { planData, planDataInvalid, planMeta, loading, regenerate: regeneratePlan } = usePlan(user?.id);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['workout', 'meal']));
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState('');
  const [regenCooldownDays, setRegenCooldownDays] = useState<number | null>(null);

  useEffect(() => {
    if (!planMeta) return;
    const lastRegen = planMeta.last_regenerated_at ? new Date(planMeta.last_regenerated_at) : new Date(planMeta.generated_at);
    const daysSince = (Date.now() - lastRegen.getTime()) / (1000 * 60 * 60 * 24);
    setRegenCooldownDays(daysSince < 30 ? Math.ceil(30 - daysSince) : null);
  }, [planMeta]);

  function toggle(section: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  }

  async function regenerate() {
    if (!user) return;
    if (regenCooldownDays !== null && regenCooldownDays > 0) {
      setRegenError(`You can regenerate your plan in ${regenCooldownDays} days.`);
      return;
    }
    setRegenLoading(true);
    setRegenError('');
    try {
      await regeneratePlan();
      setRegenCooldownDays(30);
      setRegenError('');
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : 'Failed to regenerate');
    }
    setRegenLoading(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex items-center gap-3 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin" />Loading plan...</div>
    </div>
  );

  if (planDataInvalid) return (
    <div className="max-w-2xl mx-auto py-16 text-center">
      <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
      <p className="text-white font-semibold mb-2">Your plan couldn't be loaded</p>
      <p className="text-gray-500 text-sm mb-6">It looks like your plan data is in an unexpected format. Try regenerating your plan.</p>
      <Button onClick={() => navigate('/onboarding')}>Go to onboarding</Button>
    </div>
  );

  if (!planData) return (
    <div className="max-w-2xl mx-auto py-16 text-center">
      <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
      <p className="text-white font-semibold mb-2">No active plan found</p>
      <p className="text-gray-500 text-sm mb-6">Complete onboarding to generate your personalised plan.</p>
      <Button onClick={() => navigate('/onboarding')}>Start onboarding</Button>
    </div>
  );

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 lg:pb-8">
      {/* Phase header */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Phase {planData.phase}</span>
            <h1 className="text-xl font-bold text-white mt-1">{planData.phase_name}</h1>
            <p className="text-sm text-gray-300 mt-1 leading-relaxed">{planData.phase_description}</p>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <p className="text-2xl font-bold text-white">{planData.calorie_target}</p>
            <p className="text-xs text-gray-500">kcal / day</p>
          </div>
        </div>
        <div className="flex gap-4 mt-4 pt-4 border-t border-emerald-500/10">
          <div>
            <p className="text-xs text-gray-500">Protein target</p>
            <p className="text-sm font-semibold text-white">{planData.protein_target_g}g / day</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Duration</p>
            <p className="text-sm font-semibold text-white">{planData.duration_months} months</p>
          </div>
        </div>
      </div>

      {/* Personalized notes */}
      {planData.personalized_notes && (
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">Your personalised notes</p>
            <p className="text-sm text-gray-300 leading-relaxed">{planData.personalized_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Weekly schedule */}
      {planData.weekly_schedule && (
      <Card>
        <CardHeader>
          <button className="w-full flex items-center justify-between" onClick={() => toggle('workout')}>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-400/10 flex items-center justify-center">
                <Dumbbell className="w-4 h-4 text-blue-400" />
              </span>
              <h2 className="text-sm font-semibold text-white">Weekly Workout Schedule</h2>
            </div>
            {expandedSections.has('workout') ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
        </CardHeader>
        {expandedSections.has('workout') && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-7 gap-1 mb-4">
              {days.map(day => {
                const sched = planData.weekly_schedule?.[day as keyof typeof planData.weekly_schedule];
                const isRest = sched?.is_rest_day;
                return (
                  <div key={day} className={`text-center py-2 rounded-xl ${isRest ? 'bg-gray-800/50' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                    <p className="text-xs text-gray-500">{dayLabels[day]}</p>
                    <p className="text-xs mt-1">{isRest ? 'Rest' : 'Workout'}</p>
                  </div>
                );
              })}
            </div>
            <div className="space-y-3">
              {days.filter(day => {
                const sched = planData.weekly_schedule?.[day as keyof typeof planData.weekly_schedule];
                return sched && !sched.is_rest_day && sched.workout;
              }).map(day => {
                const sched = planData.weekly_schedule?.[day as keyof typeof planData.weekly_schedule];
                const workout = sched?.workout as WorkoutSession;
                if (!workout) return null;
                return (
                  <div key={day} className="bg-gray-800/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-gray-500 capitalize">{day}</p>
                        <p className="text-sm font-semibold text-white">{workout.name}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        {workout.duration_minutes} min
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {workout.exercises.map((ex, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">{ex.name}</span>
                          <span className="text-gray-500">{ex.sets}x{ex.reps}</span>
                        </div>
                      ))}
                    </div>
                    {workout.notes && <p className="text-xs text-emerald-400/70 mt-2 italic">{workout.notes}</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>
      )}

      {/* Meals */}
      {planData.daily_meals && (
      <Card>
        <CardHeader>
          <button className="w-full flex items-center justify-between" onClick={() => toggle('meal')}>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-green-400/10 flex items-center justify-center">
                <Salad className="w-4 h-4 text-green-400" />
              </span>
              <h2 className="text-sm font-semibold text-white">Daily Meal Plan</h2>
            </div>
            {expandedSections.has('meal') ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
        </CardHeader>
        {expandedSections.has('meal') && (
          <CardContent className="pt-0 space-y-3">
            {planData.daily_meals && Object.entries(planData.daily_meals).map(([key, meal]) => (
              <div key={key} className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white capitalize">{key.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Target className="w-3 h-3" />{meal.protein_g}g protein</span>
                    <span>{meal.calories} kcal</span>
                  </div>
                </div>
                <ul className="space-y-0.5">
                  {meal.items.map((item, i) => (
                    <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">&#8226;</span>{item}
                    </li>
                  ))}
                </ul>
                {meal.notes && <p className="text-xs text-amber-400/70 mt-1.5 italic">{meal.notes}</p>}
              </div>
            ))}
          </CardContent>
        )}
      </Card>
      )}

      {/* Supplements */}
      {planData.supplements && planData.supplements.length > 0 && (
      <Card>
        <CardHeader>
          <button className="w-full flex items-center justify-between" onClick={() => toggle('supplement')}>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-amber-400/10 flex items-center justify-center">
                <Pill className="w-4 h-4 text-amber-400" />
              </span>
              <h2 className="text-sm font-semibold text-white">Supplement Stack</h2>
            </div>
            {expandedSections.has('supplement') ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
        </CardHeader>
        {expandedSections.has('supplement') && (
          <CardContent className="pt-0 space-y-3">
            {(planData.supplements ?? []).map((s: Supplement, i) => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{s.name}</p>
                    <p className="text-xs text-amber-400/80 mt-0.5">{s.dosage} - {s.timing}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.reason}</p>
                    {s.what_to_look_for && <p className="text-xs text-gray-600 mt-1">What to look for: {s.what_to_look_for}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${s.phase_start === 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>
                    Phase {s.phase_start}+
                  </span>
                </div>
                {s.approx_cost_local && <p className="text-xs text-gray-600 mt-1">{s.approx_cost_local}</p>}
              </div>
            ))}
          </CardContent>
        )}
      </Card>
      )}

      {/* Habits */}
      {planData.daily_habits && planData.daily_habits.length > 0 && (
      <Card>
        <CardHeader>
          <button className="w-full flex items-center justify-between" onClick={() => toggle('habits')}>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-sky-400/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-sky-400" />
              </span>
              <h2 className="text-sm font-semibold text-white">Daily Habits</h2>
            </div>
            {expandedSections.has('habits') ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
        </CardHeader>
        {expandedSections.has('habits') && (
          <CardContent className="pt-0 space-y-2">
            {(planData.daily_habits ?? []).map((h, i) => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-white">{h.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{h.description}</p>
                  </div>
                  <span className="text-xs text-sky-400/70 flex-shrink-0">{h.timing}</span>
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
      )}

      {/* Sleep */}
      {planData.sleep_protocol && (
      <Card>
        <CardHeader>
          <button className="w-full flex items-center justify-between" onClick={() => toggle('sleep')}>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-violet-400/10 flex items-center justify-center">
                <Moon className="w-4 h-4 text-violet-400" />
              </span>
              <h2 className="text-sm font-semibold text-white">Sleep Protocol</h2>
            </div>
            {expandedSections.has('sleep') ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
        </CardHeader>
        {expandedSections.has('sleep') && planData.sleep_protocol && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Bedtime</p>
                <p className="text-sm font-semibold text-white">{planData.sleep_protocol.target_bedtime}</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Wake up</p>
                <p className="text-sm font-semibold text-white">{planData.sleep_protocol.target_wake_time}</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Target</p>
                <p className="text-sm font-semibold text-white">{planData.sleep_protocol.sleep_hours_target}h</p>
              </div>
            </div>
            <ul className="space-y-2">
              {planData.sleep_protocol.tips.map((tip, i) => (
                <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                  <span className="text-violet-400 mt-0.5 flex-shrink-0">&#8226;</span>{tip}
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
      )}

      {/* Suggested add-ons — areas the user didn't opt into but could benefit from */}
      {planData.suggested_addons && planData.suggested_addons.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-fuchsia-400/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-fuchsia-400" />
              </span>
              <h2 className="text-sm font-semibold text-white">Consider Adding</h2>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <p className="text-xs text-gray-500 mb-1">You didn't include these in your regime — here's why they could help:</p>
            {planData.suggested_addons.map((addon, i) => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-3">
                <p className="text-sm font-medium text-white">{addon.area}</p>
                <p className="text-xs text-gray-500 mt-0.5">{addon.reason}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Regenerate */}
      <div className="border border-gray-800 rounded-2xl p-4">
        <p className="text-xs text-gray-500 mb-3">
          {regenCooldownDays !== null && regenCooldownDays > 0
            ? `You can regenerate your plan in ${regenCooldownDays} days.`
            : 'Plan not working for you? You can regenerate once every 30 days.'}
        </p>
        {regenError && <p className="text-xs text-red-400 mb-2">{regenError}</p>}
        <Button
          variant="secondary"
          size="sm"
          onClick={regenerate}
          loading={regenLoading}
          disabled={regenCooldownDays !== null && regenCooldownDays > 0}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Regenerate plan
        </Button>
      </div>
    </div>
  );
}
