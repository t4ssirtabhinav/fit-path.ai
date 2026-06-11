import React, { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Dumbbell, Sparkles, X, ClipboardList } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import type {
  GoalModality, GoalDetails, GymDetails, YogaDetails, CardioDetails,
  HomeDetails, PhysioDetails, DietDetails, SupplementDetails, ConcernsDetails,
  OnboardingData, OnboardingTrackingConfig,
} from '../types';
import { TRACKERS } from '../config/trackers';
import { COUNTRIES } from '../config/countries/countries';
import { getCuisineOptions } from '../config/countries/cuisines';
import { getSupplementBudgetOptions } from '../config/countries/currencies';
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

const GOAL_MODALITIES: { id: GoalModality; label: string; description: string; icon: string; tag?: string }[] = [
  { id: 'gym',         label: 'Gym Workout',                  description: 'Structured training with weights and machines',         icon: '🏋️' },
  { id: 'yoga',        label: 'Yoga',                         description: 'Flexibility, mindfulness, and mind-body connection',    icon: '🧘' },
  { id: 'cardio',      label: 'Walking / Running / Cardio',   description: 'Endurance, heart health, and calorie burn',            icon: '🏃' },
  { id: 'home',        label: 'Home Workout',                 description: 'Effective training with no gym required',              icon: '🏠' },
  { id: 'physio',      label: 'Physiotherapy & Recovery',     description: 'Injury recovery, pain management, and mobility',      icon: '🩹' },
  { id: 'diet',        label: 'Diet & Nutrition',             description: 'Personalised meal plan using ingredients available where you live',       icon: '🥗' },
  { id: 'supplements', label: 'Supplements',                  description: 'Targeted supplements for your goals and budget',      icon: '💊' },
  { id: 'concerns',    label: 'Other Health Concerns',        description: 'PCOS, thyroid, BP, immunity, hair, skin & more',      icon: '➕', tag: 'Add-on' },
];

const MODALITY_ORDER: GoalModality[] = ['gym', 'yoga', 'cardio', 'home', 'physio', 'diet', 'supplements', 'concerns'];

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
  if (modalities.includes('gym') && gd.gym?.days_per_week)     return gd.gym.days_per_week;
  if (modalities.includes('cardio') && gd.cardio?.days_per_week) return gd.cardio.days_per_week;
  if (modalities.includes('home'))  return 3;
  if (modalities.includes('yoga'))  return 3;
  return 3;
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

function getStageLabel(stepId: StepId): string {
  if (stepId === 'about_you')                                   return 'About You';
  if (stepId === 'intention')                                   return 'Your Path';
  if (stepId === 'goal_selection')                              return 'Goals';
  if (stepId.startsWith('goal_'))                               return 'Details';
  if (stepId === 'lifestyle')                                   return 'Lifestyle';
  if (stepId === 'plan_confirm')                                return 'All Set';
  if (stepId === 'track_setup')                                 return 'Setup';
  if (stepId === 'track_confirm')                               return 'All Set';
  return '';
}

// ========== SHARED UI COMPONENTS ==========

function ProgressBar({ stepIndex, totalSteps, stepId }: { stepIndex: number; totalSteps: number; stepId: StepId }) {
  const pct = totalSteps > 1 ? Math.round((stepIndex / (totalSteps - 1)) * 100) : 100;
  return (
    <div className="w-full mb-7">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium text-emerald-400">{getStageLabel(stepId)}</span>
        <span className="text-xs text-gray-500">{pct}% complete</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
      <p className="text-sm text-gray-400 leading-relaxed">{subtitle}</p>
    </div>
  );
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="text-sm font-medium text-gray-300 block mb-2">
      {children}
      {optional && <span className="text-xs text-gray-600 font-normal ml-1">(optional)</span>}
    </label>
  );
}

function MultiSelectChips({
  options, selected, onChange, max,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt.id);
        const capped = !active && max !== undefined && selected.length >= max;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={capped}
            onClick={() => onChange(active ? selected.filter(s => s !== opt.id) : [...selected, opt.id])}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
              active  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
              : capped ? 'bg-gray-800/40 border-gray-800 text-gray-600 cursor-not-allowed'
              :          'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function RadioCards({
  options, value, onChange,
}: {
  options: { value: string; label: string; description?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition-all duration-200 text-left ${
            value === opt.value
              ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-300'
              : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
          }`}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors ${
            value === opt.value ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'
          }`} />
          <div>
            <p className="text-sm font-medium leading-snug">{opt.label}</p>
            {opt.description && <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}

function ButtonGrid({
  options, value, onChange, cols = 2,
}: {
  options: { value: string; label: string }[];
  value: string | number;
  onChange: (v: string) => void;
  cols?: number;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-all duration-200 text-left ${
            String(value) === opt.value
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
              : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StressPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const opts = [
    { v: 1, label: 'Very calm', emoji: '😌' },
    { v: 2, label: 'Calm',      emoji: '🙂' },
    { v: 3, label: 'Moderate',  emoji: '😐' },
    { v: 4, label: 'Stressed',  emoji: '😟' },
    { v: 5, label: 'Very stressed', emoji: '😤' },
  ];
  return (
    <div className="flex gap-2">
      {opts.map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all duration-200 ${
            value === o.v
              ? 'bg-emerald-500/20 border-emerald-500'
              : 'bg-gray-800 border-gray-700 hover:border-gray-600'
          }`}
        >
          <span className="text-lg">{o.emoji}</span>
          <span className="text-xs text-gray-400 hidden sm:block">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function TagInput({
  label, tags, onChange, placeholder, hint, optional,
}: {
  label: string;
  tags: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  hint?: string;
  optional?: boolean;
}) {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const trimmed = raw.trim().slice(0, 60);
    if (trimmed && !tags.includes(trimmed) && tags.length < 20)
      onChange([...tags, trimmed]);
    setVal('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(val); }
    else if (e.key === 'Backspace' && val === '' && tags.length > 0) onChange(tags.slice(0, -1));
  }

  return (
    <div>
      <FieldLabel optional={optional}>{label}</FieldLabel>
      <div
        className="min-h-[42px] bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 flex flex-wrap gap-1.5 items-center focus-within:border-emerald-500 transition-colors cursor-text"
        onClick={() => ref.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-xs font-medium px-2 py-0.5 rounded-lg">
            {tag}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(tags.filter((_, idx) => idx !== i)); }}
              className="text-emerald-400 hover:text-white ml-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={ref}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (val.trim()) addTag(val); }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none min-w-[100px]"
        />
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
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

// --- Per-modality detail steps ---

function setGoalDetail<M extends keyof GoalDetails>(
  set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void,
  goalDetails: GoalDetails,
  modality: M,
  partial: Partial<NonNullable<GoalDetails[M]>>
) {
  set('goal_details', {
    ...goalDetails,
    [modality]: { ...(goalDetails[modality] ?? {}), ...partial } as GoalDetails[M],
  });
}

function StepGoalGym({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  const g = data.goal_details.gym ?? {} as Partial<GymDetails>;
  const upd = (partial: Partial<GymDetails>) => setGoalDetail(set, data.goal_details, 'gym', partial);

  return (
    <div className="space-y-5">
      <StepHeader title="Gym Workout" subtitle="This shapes your split, load progression, and weekly structure." />
      <div>
        <FieldLabel>How long have you been training consistently?</FieldLabel>
        <RadioCards
          value={g.experience ?? ''}
          onChange={v => upd({ experience: v })}
          options={[
            { value: 'never',        label: 'Never started' },
            { value: 'beginner',     label: '< 3 months — Beginner' },
            { value: 'intermediate', label: '3–12 months — Intermediate' },
            { value: 'advanced',     label: '1–3 years — Advanced' },
            { value: 'experienced',  label: '3+ years — Experienced' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Equipment access</FieldLabel>
        <RadioCards
          value={g.equipment ?? ''}
          onChange={v => upd({ equipment: v })}
          options={[
            { value: 'full_gym',   label: 'Full gym membership' },
            { value: 'home_gym',   label: 'Home gym (dumbbells, rack)' },
            { value: 'minimal',    label: 'Minimal (bands, dumbbells only)' },
            { value: 'bodyweight', label: 'Bodyweight only' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Training days per week</FieldLabel>
        <ButtonGrid
          cols={(['never', 'beginner'].includes(g.experience ?? '')) ? 4 : 6}
          value={g.days_per_week ?? 0}
          onChange={v => upd({ days_per_week: Number(v) })}
          options={
            ['never', 'beginner'].includes(g.experience ?? '')
              ? [{ value: '2', label: '2 days' }, { value: '3', label: '3 days' }, { value: '4', label: '4 days' }, { value: '5', label: '5 days' }]
              : [{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }, { value: '6', label: '6' }]
          }
        />
        {['never', 'beginner'].includes(g.experience ?? '') && (
          <p className="text-xs text-amber-400/70 mt-1">We recommend easing in with fewer sessions initially.</p>
        )}
      </div>
      <div>
        <FieldLabel>Primary focus <span className="text-xs text-gray-500 font-normal">— pick up to 3</span></FieldLabel>
        <MultiSelectChips
          max={3}
          selected={g.primary_focus ?? []}
          onChange={v => upd({ primary_focus: v })}
          options={[
            { id: 'build_muscle',        label: 'Build muscle' },
            { id: 'lose_fat',            label: 'Lose fat' },
            { id: 'improve_strength',    label: 'Get stronger' },
            { id: 'improve_endurance',   label: 'Endurance' },
            { id: 'improve_flexibility', label: 'Flexibility' },
            { id: 'tone_body',           label: 'Tone & define' },
            { id: 'prepare_long_term',   label: 'General fitness' },
          ]}
        />
      </div>
    </div>
  );
}

function StepGoalYoga({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  const g = data.goal_details.yoga ?? {} as Partial<YogaDetails>;
  const upd = (partial: Partial<YogaDetails>) => setGoalDetail(set, data.goal_details, 'yoga', partial);

  return (
    <div className="space-y-5">
      <StepHeader title="Yoga" subtitle="Your plan varies a lot by style and goal — these questions ensure yours is right." />
      <div>
        <FieldLabel>Your yoga experience</FieldLabel>
        <RadioCards
          value={g.experience ?? ''}
          onChange={v => upd({ experience: v })}
          options={[
            { value: 'beginner',     label: 'Complete beginner' },
            { value: 'tried_few',    label: 'Tried a few times' },
            { value: 'regular',      label: 'Regular (3–12 months)' },
            { value: 'established',  label: 'Established practice (1+ year)' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Session duration you can commit to</FieldLabel>
        <ButtonGrid
          cols={3}
          value={g.session_duration ?? ''}
          onChange={v => upd({ session_duration: v })}
          options={[
            { value: '15_20min', label: '15–20 min' },
            { value: '30_45min', label: '30–45 min' },
            { value: '60min',    label: '60+ min' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>What are you hoping yoga does for you? <span className="text-xs text-gray-500 font-normal">— up to 2</span></FieldLabel>
        <MultiSelectChips
          max={2}
          selected={g.goals ?? []}
          onChange={v => upd({ goals: v })}
          options={[
            { id: 'improve_flexibility', label: 'Improve flexibility' },
            { id: 'reduce_stress',       label: 'Reduce stress & anxiety' },
            { id: 'complement_gym',      label: 'Complement gym training' },
            { id: 'back_posture',        label: 'Back / posture relief' },
            { id: 'body_awareness',      label: 'Body awareness' },
            { id: 'build_strength',      label: 'Build strength' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Style preference</FieldLabel>
        <RadioCards
          value={g.style ?? ''}
          onChange={v => upd({ style: v })}
          options={[
            { value: 'not_sure', label: "Not sure — let the plan decide" },
            { value: 'hatha',    label: 'Hatha',   description: 'Slow, foundational, beginner-friendly' },
            { value: 'vinyasa',  label: 'Vinyasa', description: 'Flowing sequences, moderate intensity' },
            { value: 'yin',      label: 'Yin',     description: 'Deep passive stretching, held poses' },
            { value: 'power',    label: 'Power yoga', description: 'Strength-based, athletic approach' },
          ]}
        />
      </div>
    </div>
  );
}

function StepGoalCardio({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  const { age, weight_kg, height_cm } = data;
  const bmi = height_cm > 0 ? weight_kg / ((height_cm / 100) ** 2) : 0;
  const g = data.goal_details.cardio ?? {} as Partial<CardioDetails>;
  const upd = (partial: Partial<CardioDetails>) => setGoalDetail(set, data.goal_details, 'cardio', partial);

  return (
    <div className="space-y-5">
      <StepHeader title="Walking / Running / Cardio" subtitle="Cardio is paced to your current baseline so it's challenging but sustainable." />
      <div>
        <FieldLabel>Current cardio baseline</FieldLabel>
        <RadioCards
          value={g.baseline ?? ''}
          onChange={v => upd({ baseline: v })}
          options={[
            { value: 'rarely_move',    label: 'I rarely move much' },
            { value: 'casual_walking', label: 'Casual walking (< 30 min/day)' },
            { value: 'brisk_walk',     label: 'Brisk walking / occasional jog' },
            { value: 'running',        label: 'Running with a regular pace / distance' },
            { value: 'sports_hiit',    label: 'Sports or HIIT training regularly' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Activities you prefer</FieldLabel>
        <MultiSelectChips
          selected={g.activities ?? []}
          onChange={v => upd({ activities: v })}
          options={[
            { id: 'walking',  label: 'Walking' },
            { id: 'jogging',  label: 'Jogging' },
            { id: 'running',  label: 'Running' },
            { id: 'cycling',  label: 'Cycling' },
            { id: 'swimming', label: 'Swimming' },
            { id: 'hiit',     label: 'HIIT / Circuit' },
            { id: 'jump_rope',label: 'Jump rope' },
          ]}
        />
        {(age > 55 || bmi > 30) && (
          <p className="text-xs text-amber-400/70 mt-2">
            {age > 55 ? 'Low-impact options like walking and cycling are highlighted for your age group.' : 'We\'ll ease you in with walk-run intervals based on your BMI.'}
          </p>
        )}
      </div>
      <div>
        <FieldLabel>Main goal</FieldLabel>
        <RadioCards
          value={g.goal ?? ''}
          onChange={v => upd({ goal: v })}
          options={[
            { value: 'lose_fat',    label: 'Lose weight / burn fat' },
            { value: 'endurance',   label: 'Build stamina & endurance' },
            { value: 'heart_health',label: 'Heart health & longevity' },
            { value: 'stress',      label: 'Stress relief' },
            { value: 'event',       label: 'Train for an event (5K, 10K…)' },
            { value: 'complement',  label: 'Complement strength training' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Days per week</FieldLabel>
        <ButtonGrid
          cols={4}
          value={g.days_per_week ?? 0}
          onChange={v => upd({ days_per_week: Number(v) })}
          options={[
            { value: '2', label: '2 days' }, { value: '3', label: '3 days' },
            { value: '4', label: '4 days' }, { value: '5', label: '5 days' },
          ]}
        />
      </div>
    </div>
  );
}

function StepGoalHome({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  const hasGym = data.activity_modalities.includes('gym');
  const g = data.goal_details.home ?? {} as Partial<HomeDetails>;
  const upd = (partial: Partial<HomeDetails>) => setGoalDetail(set, data.goal_details, 'home', partial);

  return (
    <div className="space-y-5">
      <StepHeader title="Home Workout" subtitle="Your plan is built entirely around what you have available — no gym required." />
      <div>
        <FieldLabel>Equipment you have at home</FieldLabel>
        <MultiSelectChips
          selected={g.equipment ?? []}
          onChange={v => upd({ equipment: v })}
          options={[
            { id: 'none',             label: 'None (bodyweight only)' },
            { id: 'resistance_bands', label: 'Resistance bands' },
            { id: 'dumbbells',        label: 'Dumbbells' },
            { id: 'pullup_bar',       label: 'Pull-up bar' },
            { id: 'kettlebell',       label: 'Kettlebell' },
            { id: 'yoga_mat',         label: 'Yoga mat' },
            { id: 'jump_rope',        label: 'Jump rope' },
          ]}
        />
      </div>
      {/* Skip fitness_level and focus if gym is also selected — already captured */}
      {!hasGym && (
        <>
          <div>
            <FieldLabel>Your fitness level</FieldLabel>
            <RadioCards
              value={g.fitness_level ?? ''}
              onChange={v => upd({ fitness_level: v })}
              options={[
                { value: 'beginner',     label: 'Beginner',     description: 'New to structured training' },
                { value: 'intermediate', label: 'Intermediate', description: '6+ months of consistent exercise' },
                { value: 'advanced',     label: 'Advanced',     description: '2+ years of regular training' },
              ]}
            />
          </div>
          <div>
            <FieldLabel>Primary focus <span className="text-xs text-gray-500 font-normal">— up to 2</span></FieldLabel>
            <MultiSelectChips
              max={2}
              selected={g.primary_focus ?? []}
              onChange={v => upd({ primary_focus: v })}
              options={[
                { id: 'build_muscle',        label: 'Build muscle' },
                { id: 'lose_fat',            label: 'Lose fat' },
                { id: 'improve_strength',    label: 'Get stronger' },
                { id: 'improve_flexibility', label: 'Improve flexibility' },
                { id: 'prepare_long_term',   label: 'General fitness' },
              ]}
            />
          </div>
        </>
      )}
      {hasGym && (
        <p className="text-xs text-gray-500 bg-gray-800/50 rounded-xl px-4 py-3">
          Fitness level and focus are already captured from your Gym Workout answers.
        </p>
      )}
    </div>
  );
}

function StepGoalPhysio({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  const g = data.goal_details.physio ?? {} as Partial<PhysioDetails>;
  const upd = (partial: Partial<PhysioDetails>) => setGoalDetail(set, data.goal_details, 'physio', partial);

  return (
    <div className="space-y-5">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-300/80 leading-relaxed">
          <strong className="text-amber-300">Medical disclaimer:</strong> FitPath's recovery guidance is informational only and not a substitute for professional medical advice. Always follow your healthcare provider's instructions.
        </p>
      </div>
      <StepHeader title="Physiotherapy & Recovery" subtitle="These questions keep your plan safe and focused on what your body actually needs right now." />
      <div>
        <FieldLabel>Why did you select this?</FieldLabel>
        <RadioCards
          value={g.reason ?? ''}
          onChange={v => upd({ reason: v })}
          options={[
            { value: 'recovering_injury', label: 'Recovering from an injury' },
            { value: 'chronic_pain',      label: 'Managing chronic pain' },
            { value: 'post_surgery',      label: 'Post-surgery rehabilitation' },
            { value: 'preventing',        label: 'Preventing a recurring problem' },
            { value: 'mobility',          label: 'Improving mobility & range of motion' },
            { value: 'maintenance',       label: 'Athletic recovery & maintenance' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Focus areas <span className="text-xs text-gray-500 font-normal">— up to 3</span></FieldLabel>
        <MultiSelectChips
          max={3}
          selected={g.areas ?? []}
          onChange={v => upd({ areas: v })}
          options={[
            { id: 'lower_back',  label: 'Lower back' },
            { id: 'neck',        label: 'Neck / upper back' },
            { id: 'shoulders',   label: 'Shoulders' },
            { id: 'knees',       label: 'Knees' },
            { id: 'hips',        label: 'Hips' },
            { id: 'ankles',      label: 'Ankles / feet' },
            { id: 'wrists',      label: 'Wrists / elbows' },
            { id: 'core',        label: 'Core' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>How long has this been an issue?</FieldLabel>
        <RadioCards
          value={g.duration ?? ''}
          onChange={v => upd({ duration: v })}
          options={[
            { value: 'recent',         label: 'Recent (< 1 month)' },
            { value: 'few_months',     label: 'A few months' },
            { value: 'chronic',        label: 'Chronic (6+ months)' },
            { value: 'post_surgery',   label: 'Post-surgery' },
          ]}
        />
        {g.duration === 'post_surgery' && (
          <p className="text-xs text-amber-400/70 mt-2">We'll only include gentle mobility work. Validate with your surgeon before starting.</p>
        )}
      </div>
      <div>
        <FieldLabel>Are you currently working with a physio or doctor?</FieldLabel>
        <RadioCards
          value={g.has_professional ?? ''}
          onChange={v => upd({ has_professional: v })}
          options={[
            { value: 'yes_active',   label: 'Yes, actively in treatment' },
            { value: 'no',           label: 'No, self-managing' },
            { value: 'was_not_now',  label: 'I was, but not currently' },
          ]}
        />
      </div>
    </div>
  );
}

function StepGoalDiet({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  const g = data.goal_details.diet ?? {} as Partial<DietDetails>;
  const upd = (partial: Partial<DietDetails>) => setGoalDetail(set, data.goal_details, 'diet', partial);

  return (
    <div className="space-y-5">
      <StepHeader title="Diet & Nutrition" subtitle={`Your meal plan uses ${data.country ? `real ${data.country} ingredients` : 'ingredients available where you live'} and your exact preferences — not generic advice.`} />
      <div>
        <FieldLabel>Your diet type</FieldLabel>
        <RadioCards
          value={g.diet_type ?? ''}
          onChange={v => upd({ diet_type: v })}
          options={[
            { value: 'veg',                        label: 'Vegetarian (no eggs, no meat)' },
            { value: 'veg_eggs',                   label: 'Vegetarian + Eggs' },
            { value: 'veg_eggs_occasional_chicken', label: 'Veg + Eggs + Occasional chicken' },
            { value: 'non_veg',                    label: 'Non-vegetarian (all foods)' },
            { value: 'jain',                       label: 'Jain (no root vegetables)' },
            { value: 'sattvic',                    label: 'Sattvic (no onion / garlic / meat)' },
            { value: 'vegan',                      label: 'Vegan' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Main dietary goal</FieldLabel>
        <RadioCards
          value={g.dietary_goal ?? ''}
          onChange={v => upd({ dietary_goal: v })}
          options={[
            { value: 'lose_weight',           label: 'Lose weight' },
            { value: 'gain_weight',           label: 'Gain weight / build muscle' },
            { value: 'general',               label: 'Maintain weight, improve quality' },
            { value: 'condition_management',  label: 'Manage a health condition' },
          ]}
        />
      </div>
      {g.dietary_goal === 'condition_management' && (
        <div>
          <FieldLabel>Which condition(s)?</FieldLabel>
          <MultiSelectChips
            selected={g.conditions ?? []}
            onChange={v => upd({ conditions: v })}
            options={[
              { id: 'diabetes',    label: 'Diabetes / blood sugar' },
              { id: 'pcos',        label: 'PCOS / hormonal' },
              { id: 'thyroid',     label: 'Thyroid' },
              { id: 'high_bp',     label: 'High blood pressure' },
              { id: 'cholesterol', label: 'High cholesterol' },
              { id: 'ibs',         label: 'IBS / digestive issues' },
            ]}
          />
        </div>
      )}
      <div>
        <FieldLabel>Cuisine style <span className="text-xs text-gray-500 font-normal">— select all you enjoy</span></FieldLabel>
        <MultiSelectChips
          selected={g.cuisine_style ?? []}
          onChange={v => upd({ cuisine_style: v })}
          options={getCuisineOptions(data.country)}
        />
      </div>
      <TagInput
        label="Food allergies"
        tags={g.allergies ?? []}
        onChange={v => upd({ allergies: v })}
        placeholder="e.g. peanuts, lactose, gluten"
        hint="Press Enter or comma after each item"
        optional
      />
      <TagInput
        label="Foods you strongly dislike"
        tags={g.food_dislikes ?? []}
        onChange={v => upd({ food_dislikes: v })}
        placeholder="e.g. broccoli, mushrooms"
        hint="Press Enter or comma after each item"
        optional
      />
    </div>
  );
}

function StepGoalSupplements({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  const g = data.goal_details.supplements ?? {} as Partial<SupplementDetails>;
  const upd = (partial: Partial<SupplementDetails>) => setGoalDetail(set, data.goal_details, 'supplements', partial);

  return (
    <div className="space-y-5">
      <StepHeader title="Supplements" subtitle="We recommend only what you actually need — nothing unnecessary, all available in your region." />
      <div>
        <FieldLabel>Supplements you currently take <span className="text-xs text-gray-500 font-normal">— select all that apply</span></FieldLabel>
        <MultiSelectChips
          selected={g.current ?? []}
          onChange={v => upd({ current: v })}
          options={[
            { id: 'protein_powder', label: 'Protein powder' },
            { id: 'creatine',       label: 'Creatine' },
            { id: 'multivitamin',   label: 'Multivitamin' },
            { id: 'omega3',         label: 'Omega-3' },
            { id: 'vitamin_d',      label: 'Vitamin D' },
            { id: 'iron',           label: 'Iron' },
            { id: 'b12',            label: 'B12' },
            { id: 'pre_workout',    label: 'Pre-workout' },
            { id: 'nothing',        label: 'Nothing currently' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>What do you want supplements to help with? <span className="text-xs text-gray-500 font-normal">— up to 3</span></FieldLabel>
        <MultiSelectChips
          max={3}
          selected={g.goals ?? []}
          onChange={v => upd({ goals: v })}
          options={[
            { id: 'fill_gaps',       label: 'Fill nutritional gaps' },
            { id: 'muscle_growth',   label: 'Muscle growth' },
            { id: 'energy',          label: 'Energy & performance' },
            { id: 'hair_skin',       label: 'Hair, skin & nails' },
            { id: 'immunity',        label: 'Immunity' },
            { id: 'hormonal',        label: 'Hormonal support (PCOS/thyroid)' },
            { id: 'recovery',        label: 'Recovery & joint health' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Monthly supplement budget</FieldLabel>
        <RadioCards
          value={g.budget ?? ''}
          onChange={v => upd({ budget: v })}
          options={getSupplementBudgetOptions(data.country)}
        />
      </div>
      <div>
        <FieldLabel>Preference for vegetarian-certified supplements</FieldLabel>
        <ButtonGrid
          cols={2}
          value={g.veg_preferred ? 'yes' : (g.veg_preferred === false ? 'no' : '')}
          onChange={v => upd({ veg_preferred: v === 'yes' })}
          options={[
            { value: 'yes', label: 'Yes, strictly veg' },
            { value: 'no',  label: 'No preference' },
          ]}
        />
      </div>
    </div>
  );
}

function StepGoalConcerns({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  const { age, gender } = data;
  const g = data.goal_details.concerns ?? {} as Partial<ConcernsDetails>;
  const upd = (partial: Partial<ConcernsDetails>) => setGoalDetail(set, data.goal_details, 'concerns', partial);

  const allConcerns = [
    { id: 'Stress / anxiety',            label: 'Stress / anxiety' },
    { id: 'Sleep quality',               label: 'Sleep quality' },
    { id: 'Hair fall / thinning',         label: 'Hair fall / thinning' },
    { id: 'Skin concerns',               label: 'Skin concerns / acne' },
    { id: 'PCOS / hormonal imbalance',   label: 'PCOS / hormonal imbalance' },
    { id: 'Thyroid',                     label: 'Thyroid (hypo/hyper)' },
    { id: 'Diabetes risk / blood sugar', label: 'Diabetes risk / blood sugar' },
    { id: 'High blood pressure',         label: 'High blood pressure' },
    { id: 'High cholesterol',            label: 'High cholesterol' },
    { id: 'Digestive issues',            label: 'Digestive issues / acidity' },
    { id: 'Low immunity',                label: 'Low immunity / frequent illness' },
    { id: 'Chronic fatigue / low energy',label: 'Chronic fatigue / low energy' },
    { id: 'Posture & back pain',         label: 'Posture & back pain' },
    { id: 'Menstrual health',            label: 'Menstrual health' },
  ];

  // Re-order based on context
  const sorted = [...allConcerns].sort((a) => {
    if (gender === 'female' && (a.id === 'PCOS / hormonal imbalance' || a.id === 'Menstrual health')) return -1;
    if (age > 45 && (a.id === 'High blood pressure' || a.id === 'Diabetes risk / blood sugar' || a.id === 'High cholesterol')) return -1;
    if (age < 25 && (a.id === 'Skin concerns' || a.id === 'Hair fall / thinning')) return -1;
    return 0;
  });

  return (
    <div className="space-y-5">
      <StepHeader title="Other Health Concerns" subtitle="These get woven into your plan as targeted nutrition, habit, and lifestyle adjustments — not a separate programme." />
      <div>
        <FieldLabel>Your concerns</FieldLabel>
        <MultiSelectChips
          selected={g.items ?? []}
          onChange={v => upd({ items: v })}
          options={sorted}
        />
      </div>
      <div>
        <FieldLabel>Are you currently on medication for any of these?</FieldLabel>
        <RadioCards
          value={g.on_medication ?? ''}
          onChange={v => upd({ on_medication: v })}
          options={[
            { value: 'yes_some',      label: 'Yes, for some of them' },
            { value: 'no',            label: 'No' },
            { value: 'prefer_not_say',label: 'Prefer not to say' },
          ]}
        />
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

function StepPlanConfirm({ data, set, loading }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void; loading: boolean }) {
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

function StepTrackConfirm({ data, loading }: { data: OnboardingData; loading: boolean }) {
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
    case 'goal_gym': {
      const g = data.goal_details.gym;
      if (!g?.experience)                    return 'Please tell us about your gym experience.';
      if (!g?.equipment)                     return 'Please select your equipment access.';
      if (!g?.days_per_week)                 return 'Please select how many days per week you can train.';
      if (!g?.primary_focus?.length)         return 'Please select at least one focus area.';
      return null;
    }
    case 'goal_yoga': {
      const g = data.goal_details.yoga;
      if (!g?.experience)                    return 'Please tell us about your yoga experience.';
      if (!g?.goals?.length)                 return 'Please select at least one yoga goal.';
      return null;
    }
    case 'goal_cardio': {
      const g = data.goal_details.cardio;
      if (!g?.baseline)                      return 'Please describe your current cardio baseline.';
      if (!g?.goal)                          return 'Please select your main cardio goal.';
      return null;
    }
    case 'goal_home': {
      const g = data.goal_details.home;
      const hasGym = data.activity_modalities.includes('gym');
      if (!hasGym && !g?.fitness_level)      return 'Please select your current fitness level.';
      if (!hasGym && !g?.primary_focus?.length) return 'Please select at least one focus area.';
      return null;
    }
    case 'goal_physio': {
      const g = data.goal_details.physio;
      if (!g?.reason)                        return 'Please tell us why you selected physiotherapy & recovery.';
      if (!g?.areas?.length)                 return 'Please select at least one area to focus on.';
      if (!g?.duration)                      return 'Please select how long this has been an issue.';
      return null;
    }
    case 'goal_diet': {
      const g = data.goal_details.diet;
      if (!g?.diet_type)                     return 'Please select your diet type.';
      if (!g?.dietary_goal)                  return 'Please select your main dietary goal.';
      return null;
    }
    case 'goal_supplements': {
      const g = data.goal_details.supplements;
      if (!g?.goals?.length)                 return 'Please select at least one supplement goal.';
      if (!g?.budget)                        return 'Please select your monthly supplement budget.';
      return null;
    }
    case 'goal_concerns': {
      const g = data.goal_details.concerns;
      return g?.items?.length ? null : 'Please select at least one health concern.';
    }
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
      case 'goal_gym':          return <StepGoalGym data={data} set={set} />;
      case 'goal_yoga':         return <StepGoalYoga data={data} set={set} />;
      case 'goal_cardio':       return <StepGoalCardio data={data} set={set} />;
      case 'goal_home':         return <StepGoalHome data={data} set={set} />;
      case 'goal_physio':       return <StepGoalPhysio data={data} set={set} />;
      case 'goal_diet':         return <StepGoalDiet data={data} set={set} />;
      case 'goal_supplements':  return <StepGoalSupplements data={data} set={set} />;
      case 'goal_concerns':     return <StepGoalConcerns data={data} set={set} />;
      case 'lifestyle':         return <StepLifestyle data={data} set={set} />;
      case 'plan_confirm':      return <StepPlanConfirm data={data} set={set} loading={loading} />;
      case 'track_setup':       return <StepTrackSetup data={data} set={set} />;
      case 'track_confirm':     return <StepTrackConfirm data={data} loading={loading} />;
      default:                  return null;
    }
  }

  const isLastStep = stepIndex === stepSequence.length - 1;
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
