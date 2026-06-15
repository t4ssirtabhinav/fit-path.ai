import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Dumbbell, Sparkles, X, ClipboardList } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { ProgressBar } from '../components/onboarding/ProgressBar';
import { StepHeader } from '../components/onboarding/StepHeader';
import { FieldLabel } from '../components/onboarding/FieldLabel';
import { RadioCards } from '../components/onboarding/RadioCards';
import { ButtonGrid } from '../components/onboarding/ButtonGrid';
import { StressPicker } from '../components/onboarding/StressPicker';
import { StepGoalModality, buildFieldRenderCtx } from '../components/onboarding/StepGoalModality';
import { MODALITY_REGISTRY, MODALITY_ORDER, GOAL_MODALITIES } from '../config/modalities/registry';
import type {
  GoalModality, GoalDetails,
  OnboardingData,
} from '../types';
import { TRACKERS } from '../config/trackers';
import { COUNTRIES } from '../config/countries/countries';
import { detectTimezone, detectCountry } from '../config/countries/timezone-detect';
import { ProfileRepository } from '../repositories/ProfileRepository';
import { HealthProfileRepository } from '../repositories/HealthProfileRepository';
import { TrackingConfigRepository } from '../repositories/TrackingConfigRepository';
import type { Json } from '../types/database';

// ========== STEP TYPES ==========

type StepId =
  | 'about_you' | 'intention' | 'goal_selection'
  | 'goal_gym' | 'goal_yoga' | 'goal_cardio' | 'goal_home'
  | 'goal_physio' | 'goal_diet' | 'goal_supplements' | 'goal_concerns'
  | 'lifestyle' | 'plan_confirm'
  | 'track_setup' | 'track_confirm';

// ========== CONSTANTS ==========

const EMPTY_DATA: OnboardingData = {
  display_name: '',
  country: '',
  age: 0,
  gender: '',
  weight_kg: 0,
  height_cm: 0,
  onboarding_path: null,
  activity_modalities: [],
  goal_details: {},
  sleep_hours_current: 7,
  stress_level: 3,
  hydration_level: '',
  job_type: '',
  preferred_workout_time: '',
  goal_timeline_months: 3,
  lifestyle_injuries: '',
  medications: '',
  personalization_comments: '',
  tracking_config: { selected_trackers: [], reminder_morning: '', reminder_evening: '', reminder_style: 'simple' },
};

// ========== UTILITIES ==========

function buildStepSequence(path: 'plan' | 'track' | null, modalities: GoalModality[]): StepId[] {
  const base: StepId[] = ['about_you', 'intention'];
  if (!path) return base;
  if (path === 'track') return [...base, 'track_setup', 'track_confirm'];
  const steps: StepId[] = [...base, 'goal_selection'];
  for (const m of MODALITY_ORDER) {
    if (modalities.includes(m)) steps.push(`goal_${m}` as StepId);
  }
  steps.push('lifestyle', 'plan_confirm');
  return steps;
}

function derivedBodyType(weight_kg: number, height_cm: number): string {
  if (!weight_kg || !height_cm) return 'average_some_fat';
  const bmi = weight_kg / ((height_cm / 100) ** 2);
  if (bmi < 18.5) return 'thin_low_muscle';
  if (bmi < 23)   return 'lean_fit';
  if (bmi < 27.5) return 'average_some_fat';
  if (bmi < 32)   return 'overweight';
  return 'bulky_high_fat';
}

function derivedActivityLevel(jobType: string): string {
  const m: Record<string, string> = {
    desk_job: 'sedentary', light_physical: 'lightly_active',
    moderately_active: 'moderately_active', very_active: 'very_active', student: 'lightly_active',
  };
  return m[jobType] ?? 'sedentary';
}

function derivedFitnessGoals(modalities: GoalModality[], gd: GoalDetails): string[] {
  const goals = new Set<string>();
  if (modalities.includes('gym') && gd.gym?.primary_focus)
    gd.gym.primary_focus.forEach(f => goals.add(f));
  if (modalities.includes('home') && gd.home?.primary_focus)
    gd.home.primary_focus.forEach(f => goals.add(f));
  if (modalities.includes('yoga')) {
    goals.add('improve_flexibility');
    gd.yoga?.goals?.forEach(g => {
      if (g === 'reduce_stress')  goals.add('reduce_stress');
      if (g === 'back_posture')   goals.add('improve_posture');
      if (g === 'build_strength') goals.add('improve_strength');
    });
  }
  if (modalities.includes('cardio')) {
    goals.add('improve_endurance');
    if (gd.cardio?.goal === 'lose_fat')     goals.add('lose_fat');
    if (gd.cardio?.goal === 'heart_health') goals.add('prepare_long_term');
  }
  if (modalities.includes('physio')) { goals.add('reduce_pain'); goals.add('improve_flexibility'); }
  if (modalities.includes('diet') && gd.diet) {
    const m: Record<string, string> = {
      lose_weight: 'lose_fat', gain_weight: 'gain_weight',
      condition_management: 'manage_diabetes', general: 'prepare_long_term',
    };
    const mapped = m[gd.diet.dietary_goal];
    if (mapped) goals.add(mapped);
  }
  if (modalities.includes('supplements')) goals.add('improve_immunity');
  if (modalities.includes('concerns') && gd.concerns) {
    const m: Record<string, string> = {
      'Stress / anxiety': 'reduce_stress', 'Sleep quality': 'better_sleep',
      'PCOS / hormonal imbalance': 'manage_pcos', 'Thyroid': 'manage_pcos',
      'Chronic fatigue / low energy': 'more_energy', 'Posture & back pain': 'improve_posture',
      'Menstrual health': 'period_health', 'Diabetes risk / blood sugar': 'manage_diabetes',
      'Hair fall / thinning': 'hair_skin_health',
    };
    gd.concerns.items?.forEach(item => { if (m[item]) goals.add(m[item]); });
  }
  return Array.from(goals);
}

function derivedCommitmentDays(modalities: GoalModality[], gd: GoalDetails): number {
  if (modalities.includes('gym') && gd.gym?.workout_days?.length)     return gd.gym.workout_days.length;
  if (modalities.includes('cardio') && gd.cardio?.workout_days?.length) return gd.cardio.workout_days.length;
  if (modalities.includes('gym') && gd.gym?.days_per_week)     return gd.gym.days_per_week;
  if (modalities.includes('cardio') && gd.cardio?.days_per_week) return gd.cardio.days_per_week;
  if (modalities.includes('home'))  return 3;
  if (modalities.includes('yoga'))  return 3;
  return 3;
}

function derivedWorkoutDays(modalities: GoalModality[], gd: GoalDetails): string[] | null {
  if (modalities.includes('gym') && gd.gym?.workout_days?.length) return gd.gym.workout_days;
  if (modalities.includes('cardio') && gd.cardio?.workout_days?.length) return gd.cardio.workout_days;
  return null;
}

function sanitizeComment(c: string): string | null {
  if (!c?.trim()) return null;
  const t = c.trim().slice(0, 300);
  const healthTokens = /\b(workout|gym|yoga|run|walk|diet|food|sleep|pain|injury|goal|weight|muscle|fat|stress|health|fitness|protein|cardio|exercise|supplement|water|energy|strength|flexibility|recovery|meditation)\b/i;
  if (!healthTokens.test(t)) return null;
  return t
    .replace(/(ignore\s+(previous|above|all)\s+instructions?)/gi, '')
    .replace(/(system\s*:\s*)/gi, '')
    .replace(/^(you\s+(are|must|should|will|shall|ignore)\b.*)$/gim, '')
    .trim() || null;
}

// ========== STEP COMPONENTS ==========

function StepAboutYou({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  return (
    <div className="space-y-4">
      <StepHeader title="Tell us about yourself" subtitle="Your basic stats personalise everything from day one — your age, body composition, and location all shape what we recommend." />
      <Input
        label="What should we call you?"
        value={data.display_name}
        onChange={e => set('display_name', e.target.value)}
        placeholder="Arjun"
        maxLength={50}
        required
      />
      <Select
        label="Country"
        value={data.country}
        onChange={e => set('country', e.target.value)}
        options={[
          { value: '', label: 'Select your country…' },
          ...COUNTRIES.map(c => ({ value: c, label: c })),
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Age"
          type="number"
          value={data.age || ''}
          onChange={e => set('age', Number(e.target.value))}
          placeholder="27"
          min={13} max={100}
        />
        <Select
          label="Gender"
          value={data.gender}
          onChange={e => set('gender', e.target.value)}
          options={[
            { value: '',           label: 'Select…' },
            { value: 'male',       label: 'Male' },
            { value: 'female',     label: 'Female' },
            { value: 'non_binary', label: 'Non-binary' },
            { value: 'prefer_not', label: 'Prefer not to say' },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Weight (kg)"
          type="number"
          value={data.weight_kg || ''}
          onChange={e => set('weight_kg', Number(e.target.value))}
          placeholder="68"
          min={20} max={300}
        />
        <Input
          label="Height (cm)"
          type="number"
          value={data.height_cm || ''}
          onChange={e => set('height_cm', Number(e.target.value))}
          placeholder="168"
          min={80} max={250}
        />
      </div>
      {data.age >= 13 && data.age < 16 && (
        <p className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-2.5">
          FitPath is designed for 16+. Your plan will be conservative and recovery-focused.
        </p>
      )}
    </div>
  );
}

function StepIntention({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  return (
    <div className="space-y-4">
      <StepHeader title="How do you want to use FitPath?" subtitle="Both paths are equal. You can switch any time from your profile." />
      {(
        [
          {
            path: 'plan' as const,
            icon: <Sparkles className="w-6 h-6 text-emerald-400" />,
            title: 'Build me a personalised plan',
            description: "Tell us your goals and lifestyle. We'll create a Phase 1 plan covering workouts, meals, supplements, and habits.",
          },
          {
            path: 'track' as const,
            icon: <ClipboardList className="w-6 h-6 text-blue-400" />,
            title: "I'll track my own routine",
            description: 'Already have a routine? Set up what you want to log — workouts, diet, vitals, sleep, and more.',
          },
        ] as const
      ).map(opt => (
        <button
          key={opt.path}
          type="button"
          onClick={() => set('onboarding_path', opt.path)}
          className={`w-full flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 text-left ${
            data.onboarding_path === opt.path
              ? 'bg-emerald-500/10 border-emerald-500/60'
              : 'bg-gray-800 border-gray-700 hover:border-gray-600'
          }`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            opt.path === 'plan' ? 'bg-emerald-500/15' : 'bg-blue-500/15'
          }`}>
            {opt.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">{opt.title}</p>
            <p className="text-xs text-gray-400 leading-relaxed">{opt.description}</p>
          </div>
          {data.onboarding_path === opt.path && (
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 ml-auto mt-0.5">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function StepGoalSelection({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  const { age, gender } = data;

  function toggle(id: GoalModality) {
    const mods = data.activity_modalities;
    const next = mods.includes(id) ? mods.filter(m => m !== id) : [...mods, id];
    // If deselecting a modality, clear its goal_details
    const newDetails = { ...data.goal_details };
    if (!next.includes(id)) delete newDetails[id as keyof GoalDetails];
    set('activity_modalities', next);
    set('goal_details', newDetails);
  }

  // Sort: prioritise modalities based on user context
  const sorted = [...GOAL_MODALITIES].sort((a, b) => {
    const aScore = (age > 55 && a.id === 'physio' ? -3 : 0)
      + (gender === 'female' && a.id === 'concerns' ? -2 : 0);
    const bScore = (age > 55 && b.id === 'physio' ? -3 : 0)
      + (gender === 'female' && b.id === 'concerns' ? -2 : 0);
    return aScore - bScore;
  });

  return (
    <div className="space-y-4">
      <StepHeader
        title="What do you want to work on?"
        subtitle="Select everything that applies. You'll get focused questions for each — only what's relevant to you."
      />
      {data.activity_modalities.length === 0 && (
        <p className="text-xs text-gray-500">Select at least one to continue.</p>
      )}
      <div className="space-y-2">
        {sorted.map(opt => {
          const active = data.activity_modalities.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 text-left ${
                active
                  ? 'bg-emerald-500/10 border-emerald-500/60'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
              }`}
            >
              <span className="text-xl flex-shrink-0">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{opt.label}</p>
                  {opt.tag && (
                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">{opt.tag}</span>
                  )}
                  {gender === 'female' && opt.id === 'concerns' && (
                    <span className="text-xs text-purple-400/80">Includes PCOS, hormonal health</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
              </div>
              <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                active ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
              }`}>
                {active && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepLifestyle({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  const hasWorkout = data.activity_modalities.some(m => ['gym', 'home', 'cardio', 'yoga'].includes(m));

  return (
    <div className="space-y-5">
      <StepHeader title="Your lifestyle" subtitle="These final details calibrate intensity and recovery across your plan." />

      <div>
        <FieldLabel>Current sleep per night — <span className="text-emerald-400 font-semibold">{data.sleep_hours_current}h</span></FieldLabel>
        <input
          type="range" min={4} max={12} step={0.5}
          value={data.sleep_hours_current}
          onChange={e => set('sleep_hours_current', Number(e.target.value))}
          className="w-full accent-emerald-500 mt-1"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>4h</span><span className="text-gray-500">8h (ideal)</span><span>12h</span>
        </div>
      </div>

      <div>
        <FieldLabel>Daily stress level</FieldLabel>
        <StressPicker value={data.stress_level} onChange={v => set('stress_level', v)} />
      </div>

      <div>
        <FieldLabel>Daily water intake</FieldLabel>
        <ButtonGrid
          cols={4}
          value={data.hydration_level}
          onChange={v => set('hydration_level', v)}
          options={[
            { value: 'under_1l', label: '< 1 L' },
            { value: '1_2l',     label: '1–2 L' },
            { value: '2_3l',     label: '2–3 L' },
            { value: 'over_3l',  label: '3+ L' },
          ]}
        />
      </div>

      <div>
        <FieldLabel>What does your typical day look like?</FieldLabel>
        <RadioCards
          value={data.job_type}
          onChange={v => set('job_type', v)}
          options={[
            { value: 'desk_job',         label: 'Desk job',                 description: 'Mostly sitting — office, WFH, or study' },
            { value: 'light_physical',   label: 'Light physical',           description: 'Some standing, walking, light chores' },
            { value: 'moderately_active',label: 'Moderately active',        description: 'On feet most of the day' },
            { value: 'very_active',      label: 'Very physically active',   description: 'Manual work, field work, heavy movement' },
            { value: 'student',          label: 'Student',                  description: 'Mix of sitting, walking, and varied activity' },
          ]}
        />
      </div>

      {hasWorkout && (
        <div>
          <FieldLabel>Preferred workout time</FieldLabel>
          <ButtonGrid
            cols={2}
            value={data.preferred_workout_time}
            onChange={v => set('preferred_workout_time', v)}
            options={[
              { value: 'early_morning', label: 'Early morning (5–7 am)' },
              { value: 'morning',       label: 'Morning (7–9 am)' },
              { value: 'afternoon',     label: 'Afternoon (12–3 pm)' },
              { value: 'evening',       label: 'Evening (5–8 pm)' },
              { value: 'night',         label: 'Night (after 8 pm)' },
              { value: 'flexible',      label: 'Flexible / no preference' },
            ]}
          />
        </div>
      )}

      <div>
        <FieldLabel>When do you want to see results?</FieldLabel>
        <div className="flex gap-2">
          {[
            { value: 1,  label: '1 month' },
            { value: 3,  label: '3 months' },
            { value: 6,  label: '6 months' },
            { value: 12, label: '1 year' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set('goal_timeline_months', opt.value)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
                data.goal_timeline_months === opt.value
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepPlanConfirm({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  const mods = data.activity_modalities;
  const bmi = data.height_cm > 0 ? (data.weight_kg / ((data.height_cm / 100) ** 2)).toFixed(1) : '—';

  return (
    <div className="space-y-5">
      <div className="text-center py-3">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 rounded-2xl mb-3">
          <Sparkles className="w-7 h-7 text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-1">You're all set!</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          We have everything we need. Your Phase 1 plan will cover{' '}
          {mods.filter(m => ['gym', 'yoga', 'cardio', 'home'].includes(m)).length > 0 ? 'workouts, ' : ''}
          {mods.includes('diet') ? 'meals, ' : ''}
          {mods.includes('supplements') ? 'supplements, ' : ''}
          habits, and sleep protocol.
        </p>
      </div>

      <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
        {[
          { label: 'Name',    value: data.display_name },
          { label: 'Age',     value: `${data.age} years` },
          { label: 'Stats',   value: `${data.weight_kg} kg · ${data.height_cm} cm · BMI ${bmi}` },
          { label: 'Goals',   value: GOAL_MODALITIES.filter(m => mods.includes(m.id)).map(m => m.label).join(', ') || '—' },
          { label: 'Timeline', value: `${data.goal_timeline_months} month${data.goal_timeline_months > 1 ? 's' : ''}` },
        ].map(row => (
          <div key={row.label} className="flex justify-between items-start gap-4">
            <span className="text-gray-500 flex-shrink-0">{row.label}</span>
            <span className="text-white font-medium text-right">{row.value}</span>
          </div>
        ))}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-300 block mb-1.5">
          Anything else for your AI coach?
          <span className="text-xs text-gray-600 font-normal ml-1">(optional, health topics only)</span>
        </label>
        <textarea
          value={data.personalization_comments}
          onChange={e => set('personalization_comments', e.target.value)}
          placeholder="e.g. I have a wedding in 2 months, I prefer home workouts on weekends, I wake up at 5am…"
          maxLength={300}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px] resize-y transition-colors"
        />
        <p className="text-xs text-gray-600 mt-1 flex justify-between">
          <span>Keep it health and fitness related</span>
          <span>{data.personalization_comments.length}/300</span>
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-300 block mb-1.5">
          Injuries or physical limitations
          <span className="text-xs text-gray-600 font-normal ml-1">(optional)</span>
        </label>
        <input
          type="text"
          value={data.lifestyle_injuries}
          onChange={e => set('lifestyle_injuries', e.target.value.slice(0, 200))}
          placeholder="e.g. left knee pain, herniated L4-L5"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-300 block mb-1.5">
          Current medications or supplements
          <span className="text-xs text-gray-600 font-normal ml-1">(optional)</span>
        </label>
        <input
          type="text"
          value={data.medications}
          onChange={e => set('medications', e.target.value.slice(0, 200))}
          placeholder="e.g. Thyronorm 50mcg, Vitamin D3 60K"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
        />
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
        <p className="text-xs text-amber-300/70 text-center leading-relaxed">
          Your plan is generated by AI for general guidance only. Always consult a healthcare professional before starting a new diet, supplement, or exercise programme.
        </p>
      </div>
    </div>
  );
}

function StepTrackSetup({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  const tc = data.tracking_config;

  function toggleTracker(id: string) {
    const next = tc.selected_trackers.includes(id)
      ? tc.selected_trackers.filter(t => t !== id)
      : [...tc.selected_trackers, id];
    set('tracking_config', { ...tc, selected_trackers: next });
  }

  return (
    <div className="space-y-5">
      <StepHeader title="What do you want to track?" subtitle="Select the areas you want FitPath to help you log. You can add or remove trackers any time from settings." />
      <div className="space-y-2">
        {TRACKERS.map(t => {
          const active = tc.selected_trackers.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTracker(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 text-left ${
                active ? 'bg-emerald-500/10 border-emerald-500/60' : 'bg-gray-800 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{t.label}</p>
                <p className="text-xs text-gray-500">{t.description}</p>
              </div>
              <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                active ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
              }`}>
                {active && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div>
        <FieldLabel optional>Morning check-in reminder</FieldLabel>
        <div className="flex gap-3 items-center">
          <input
            type="time"
            value={tc.reminder_morning}
            onChange={e => set('tracking_config', { ...tc, reminder_morning: e.target.value })}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
          />
          {tc.reminder_morning && (
            <button type="button" onClick={() => set('tracking_config', { ...tc, reminder_morning: '' })} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div>
        <FieldLabel optional>Evening log reminder</FieldLabel>
        <div className="flex gap-3 items-center">
          <input
            type="time"
            value={tc.reminder_evening}
            onChange={e => set('tracking_config', { ...tc, reminder_evening: e.target.value })}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
          />
          {tc.reminder_evening && (
            <button type="button" onClick={() => set('tracking_config', { ...tc, reminder_evening: '' })} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepTrackConfirm({ data }: { data: OnboardingData }) {
  const selected = TRACKERS.filter(t => data.tracking_config.selected_trackers.includes(t.id));
  return (
    <div className="space-y-5">
      <div className="text-center py-3">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-500/10 rounded-2xl mb-3">
          <ClipboardList className="w-7 h-7 text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-1">Ready to track</h2>
        <p className="text-sm text-gray-400">You're set up to log {selected.length} area{selected.length !== 1 ? 's' : ''}.</p>
      </div>
      {selected.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-2">What you'll track:</p>
          <div className="flex flex-wrap gap-1.5">
            {selected.map(t => (
              <span key={t.id} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                {t.label}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500 text-center">
        You can switch to a personalised AI plan any time from your profile.
      </p>
    </div>
  );
}

// ========== VALIDATION ==========

function validateModalityFields(modality: GoalModality, data: OnboardingData): string | null {
  const definition = MODALITY_REGISTRY[modality];
  const ctx = buildFieldRenderCtx(data);
  const details = (data.goal_details[modality] ?? {}) as Record<string, unknown>;
  for (const field of definition.uiFields) {
    if (field.visibleIf && !field.visibleIf(ctx)) continue;
    const required = typeof field.required === 'function' ? field.required(ctx) : field.required;
    if (!required) continue;
    const value = details[field.key];
    const isEmpty = field.kind === 'multiselect' || field.kind === 'tags'
      ? !(Array.isArray(value) && value.length > 0)
      : value === undefined || value === null || value === '' || value === 0;
    if (isEmpty) return field.requiredMessage ?? 'Please complete this field.';
  }
  return null;
}

function validateStep(stepId: StepId, data: OnboardingData): string | null {
  switch (stepId) {
    case 'about_you': {
      const name = data.display_name.trim();
      if (!name || name.length < 2)         return 'Please enter your name (at least 2 characters).';
      if (name.length > 50)                  return 'Name must be under 50 characters.';
      if (/[<>&"'`{}[\]\\]/.test(name))     return 'Name contains invalid characters.';
      if (!data.age || data.age < 13 || data.age > 100) return 'Please enter a valid age (13–100).';
      if (!data.gender)                      return 'Please select your gender.';
      if (!data.weight_kg || data.weight_kg < 20 || data.weight_kg > 300) return 'Please enter a valid weight (20–300 kg).';
      if (!data.height_cm || data.height_cm < 80 || data.height_cm > 250) return 'Please enter a valid height (80–250 cm).';
      return null;
    }
    case 'intention':
      return data.onboarding_path ? null : 'Please select how you want to use FitPath.';
    case 'goal_selection':
      return data.activity_modalities.length > 0 ? null : 'Select at least one goal to continue.';
    case 'goal_gym':
      return validateModalityFields('gym', data);
    case 'goal_yoga':
      return validateModalityFields('yoga', data);
    case 'goal_cardio':
      return validateModalityFields('cardio', data);
    case 'goal_home':
      return validateModalityFields('home', data);
    case 'goal_physio':
      return validateModalityFields('physio', data);
    case 'goal_diet':
      return validateModalityFields('diet', data);
    case 'goal_supplements':
      return validateModalityFields('supplements', data);
    case 'goal_concerns':
      return validateModalityFields('concerns', data);
    case 'lifestyle': {
      if (!data.job_type)                    return 'Please tell us what your typical day looks like.';
      const hasWorkout = data.activity_modalities.some(m => ['gym', 'home', 'cardio', 'yoga'].includes(m));
      if (hasWorkout && !data.preferred_workout_time) return 'Please select your preferred workout time.';
      if (!data.goal_timeline_months)        return 'Please select when you want to see results.';
      return null;
    }
    case 'track_setup':
      return data.tracking_config.selected_trackers.length > 0 ? null : 'Please select at least one tracker to continue.';
    case 'plan_confirm':
    case 'track_confirm':
      return null;
    default:
      return null;
  }
}

// ========== MAIN COMPONENT ==========

export function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<OnboardingData>(() => ({
    ...EMPTY_DATA,
    country: detectCountry(),
  }));
  const [stepSequence, setStepSequence] = useState<StepId[]>(['about_you', 'intention']);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [prefilling, setPrefilling] = useState(true);
  const [error, setError] = useState('');

  const isEdit = profile?.onboarding_complete === true;
  const currentStep = stepSequence[stepIndex];

  // Recompute step sequence whenever path or modalities change
  useEffect(() => {
    const newSeq = buildStepSequence(data.onboarding_path, data.activity_modalities);
    setStepSequence(newSeq);
    // If current step is no longer in sequence, stay at same index clamped
    setStepIndex(i => Math.min(i, newSeq.length - 1));
  }, [data.onboarding_path, data.activity_modalities]);

  // Pre-populate for returning users
  useEffect(() => {
    if (!user) { setPrefilling(false); return; }
    async function load() {
      const [hp, prof, tc] = await Promise.all([
        HealthProfileRepository.getForUser(user!.id),
        ProfileRepository.getForUser(user!.id),
        TrackingConfigRepository.getForUser(user!.id),
      ]);

      if (!hp && !prof) { setPrefilling(false); return; }

      const storedDetails = (hp?.onboarding_details ?? {}) as GoalDetails;
      const storedModalities = (hp?.activity_modalities ?? []) as GoalModality[];
      const storedPath = prof?.onboarding_path ?? null;

      // Reconstruct plain injuries from legacy injuries column (physio areas are
      // tracked separately in onboarding_details, allergies have their own column)
      const rawInjuries = (hp?.injuries ?? []) as string[];
      const injuries = rawInjuries.filter(i => !i.startsWith('physio: ')).join(', ');
      const allergies = (hp?.allergies ?? []) as string[];

      setData(prev => ({
        ...prev,
        display_name: prof?.display_name ?? prev.display_name,
        country: prof?.country ?? (prev.country || detectCountry()),
        onboarding_path: storedPath as 'plan' | 'track' | null,
        activity_modalities: storedModalities,
        age: hp?.age ?? prev.age,
        weight_kg: hp?.weight_kg ?? prev.weight_kg,
        height_cm: hp?.height_cm ?? prev.height_cm,
        gender: hp?.gender ?? prev.gender,
        sleep_hours_current: hp?.sleep_hours_current ?? prev.sleep_hours_current,
        stress_level: hp?.stress_level ?? prev.stress_level,
        hydration_level: hp?.hydration_level ?? prev.hydration_level,
        job_type: hp?.job_type ?? prev.job_type,
        preferred_workout_time: hp?.preferred_workout_time ?? prev.preferred_workout_time,
        goal_timeline_months: hp?.goal_timeline_months ?? prev.goal_timeline_months,
        lifestyle_injuries: injuries,
        medications: hp?.medications ?? prev.medications,
        personalization_comments: hp?.personalization_comments ?? prev.personalization_comments,
        // Restore diet details from legacy columns for users who did the old onboarding
        goal_details: storedModalities.length > 0 ? {
          ...storedDetails,
          diet: storedDetails.diet ?? (hp?.diet_type ? {
            diet_type: hp.diet_type,
            dietary_goal: '',
            cuisine_style: hp.food_preferences ?? [],
            allergies,
            food_dislikes: hp.food_dislikes ?? [],
            conditions: [],
          } : undefined),
        } : {},
        tracking_config: tc ? {
          selected_trackers: tc.selected_trackers ?? [],
          reminder_morning: tc.reminder_morning ?? '',
          reminder_evening: tc.reminder_evening ?? '',
          reminder_style: tc.reminder_style ?? 'simple',
        } : prev.tracking_config,
      }));
      setPrefilling(false);
    }
    load();
  }, [user]);

  const set = useCallback(<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  async function saveDraft(d: OnboardingData) {
    if (!user) return;
    const modalities = d.activity_modalities;
    const gd = d.goal_details;

    const browserTimezone = detectTimezone();

    const injuriesArr = [
      ...(d.lifestyle_injuries ? d.lifestyle_injuries.split(',').map(s => s.trim()).filter(Boolean) : []),
      ...(gd.physio?.areas?.map(a => `physio: ${a}`) ?? []),
    ];

    await Promise.all([
      ProfileRepository.update(user.id, {
        display_name: d.display_name.trim() || undefined,
        country: d.country || null,
        onboarding_path: d.onboarding_path,
        ...(browserTimezone ? { timezone: browserTimezone } : {}),
      }),

      HealthProfileRepository.upsert(user.id, {
        age: d.age || null,
        weight_kg: d.weight_kg || null,
        height_cm: d.height_cm || null,
        gender: d.gender || null,
        body_type: derivedBodyType(d.weight_kg, d.height_cm),
        // job_type and per-modality details are only collected on the 'plan' path —
        // for 'track' users, leave these null rather than defaulting to misleading values
        // (e.g. "sedentary" or "3 days/week" that the user never actually entered).
        activity_level: d.onboarding_path === 'track' ? null : derivedActivityLevel(d.job_type),
        fitness_goals: derivedFitnessGoals(modalities, gd),
        diet_type: gd.diet?.diet_type || null,
        health_concerns: gd.concerns?.items ?? [],
        injuries: injuriesArr,
        allergies: gd.diet?.allergies ?? [],
        medications: d.medications || null,
        food_preferences: gd.diet?.cuisine_style ?? [],
        food_dislikes: gd.diet?.food_dislikes ?? [],
        sleep_hours_current: d.sleep_hours_current,
        commitment_days_per_week: d.onboarding_path === 'track' ? null : derivedCommitmentDays(modalities, gd),
        preferred_workout_days: d.onboarding_path === 'track' ? null : derivedWorkoutDays(modalities, gd),
        preferred_workout_time: d.preferred_workout_time || null,
        goal_timeline_months: d.goal_timeline_months || null,
        personalization_comments: sanitizeComment(d.personalization_comments),
        activity_modalities: modalities,
        onboarding_details: gd as unknown as Json,
        stress_level: d.stress_level || null,
        hydration_level: d.hydration_level || null,
        job_type: d.job_type || null,
      }),
    ]);
  }

  async function handleNext() {
    setError('');
    const err = validateStep(currentStep, data);
    if (err) { setError(err); return; }
    await saveDraft(data);
    setStepIndex(i => Math.min(i + 1, stepSequence.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleBack() {
    setError('');
    if (stepIndex === 0) {
      if (isEdit) navigate('/plan');
      return;
    }
    await saveDraft(data);
    setStepIndex(i => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmitPlan() {
    setError('');
    const err = validateStep(currentStep, data);
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      await saveDraft(data);
      // Stamp onboarding time — edge function uses this to bypass the 30-day
      // rate limit when an existing user re-onboards and requests a fresh plan.
      await ProfileRepository.update(user!.id, { last_onboarded_at: new Date().toISOString() });
      navigate('/generate-plan');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  async function handleSubmitTrack() {
    setError('');
    const err = validateStep(currentStep, data);
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      await saveDraft(data);
      // Save tracking config
      await TrackingConfigRepository.upsert(user!.id, {
        selected_trackers: data.tracking_config.selected_trackers,
        reminder_morning: data.tracking_config.reminder_morning || null,
        reminder_evening: data.tracking_config.reminder_evening || null,
        reminder_style: data.tracking_config.reminder_style,
      });
      // Mark onboarding complete for tracking users
      await ProfileRepository.update(user!.id, { onboarding_complete: true });
      await refreshProfile();
      navigate('/dashboard');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  if (prefilling) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  function renderStep() {
    switch (currentStep) {
      case 'about_you':         return <StepAboutYou data={data} set={set} />;
      case 'intention':         return <StepIntention data={data} set={set} />;
      case 'goal_selection':    return <StepGoalSelection data={data} set={set} />;
      case 'goal_gym':          return <StepGoalModality modality="gym" data={data} set={set} />;
      case 'goal_yoga':         return <StepGoalModality modality="yoga" data={data} set={set} />;
      case 'goal_cardio':       return <StepGoalModality modality="cardio" data={data} set={set} />;
      case 'goal_home':         return <StepGoalModality modality="home" data={data} set={set} />;
      case 'goal_physio':       return <StepGoalModality modality="physio" data={data} set={set} />;
      case 'goal_diet':         return <StepGoalModality modality="diet" data={data} set={set} />;
      case 'goal_supplements':  return <StepGoalModality modality="supplements" data={data} set={set} />;
      case 'goal_concerns':     return <StepGoalModality modality="concerns" data={data} set={set} />;
      case 'lifestyle':         return <StepLifestyle data={data} set={set} />;
      case 'plan_confirm':      return <StepPlanConfirm data={data} set={set} />;
      case 'track_setup':       return <StepTrackSetup data={data} set={set} />;
      case 'track_confirm':     return <StepTrackConfirm data={data} />;
      default:                  return null;
    }
  }

  const isPlanConfirm = currentStep === 'plan_confirm';
  const isTrackConfirm = currentStep === 'track_confirm';

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          {(stepIndex > 0 || isEdit) && (
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-3 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {stepIndex === 0 && isEdit ? 'Back to my plan' : 'Back'}
            </button>
          )}
          <div className="inline-flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-2">
            <Dumbbell className="w-4 h-4" />
            FitPath
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? 'Update your profile' : "Let's get started"}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {isEdit ? 'Update your details below.' : 'Answer honestly — the more detail, the better your outcome.'}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
          <ProgressBar stepIndex={stepIndex} totalSteps={stepSequence.length} stepId={currentStep} />

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-5 flex items-start gap-2">
              <span className="text-red-400 text-xs mt-0.5">⚠</span>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {renderStep()}

          <div className="flex gap-3 mt-8">
            {stepIndex > 0 && (
              <Button variant="secondary" onClick={handleBack} className="flex-shrink-0 px-4">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            {isPlanConfirm ? (
              <Button onClick={handleSubmitPlan} loading={loading} className="flex-1" size="lg">
                <Sparkles className="w-4 h-4" />
                Generate my plan
              </Button>
            ) : isTrackConfirm ? (
              <Button onClick={handleSubmitTrack} loading={loading} className="flex-1" size="lg">
                <ClipboardList className="w-4 h-4" />
                Start tracking
              </Button>
            ) : (
              <Button onClick={handleNext} className="flex-1">
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
