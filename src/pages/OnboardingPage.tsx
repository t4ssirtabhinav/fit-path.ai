import React, { useState, useRef, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Dumbbell, Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import type { OnboardingData } from '../types';

const TOTAL_STEPS = 7;

const FITNESS_GOALS = [
  { id: 'lose_fat', label: 'Lose body fat' },
  { id: 'reduce_visceral_fat', label: 'Reduce belly / visceral fat' },
  { id: 'build_muscle', label: 'Build muscle' },
  { id: 'tone_body', label: 'Tone & define body' },
  { id: 'improve_strength', label: 'Improve strength' },
  { id: 'improve_endurance', label: 'Improve stamina / endurance' },
  { id: 'improve_flexibility', label: 'Improve flexibility & mobility' },
  { id: 'better_sleep', label: 'Better sleep quality' },
  { id: 'more_energy', label: 'More daily energy' },
  { id: 'reduce_stress', label: 'Reduce stress / anxiety' },
  { id: 'improve_immunity', label: 'Improve immunity' },
  { id: 'reduce_pain', label: 'Reduce body pain / inflammation' },
  { id: 'improve_posture', label: 'Fix posture & back' },
  { id: 'prepare_long_term', label: 'Long-term health & longevity' },
  { id: 'manage_pcos', label: 'Manage PCOS / hormones' },
  { id: 'hair_skin_health', label: 'Improve hair, skin & nails' },
  { id: 'period_health', label: 'Better menstrual health' },
  { id: 'gain_weight', label: 'Healthy weight gain' },
  { id: 'athletic_performance', label: 'Sports / athletic performance' },
  { id: 'manage_diabetes', label: 'Manage blood sugar / diabetes risk' },
];

const HEALTH_CONCERNS = [
  { id: 'visceral_fat', label: 'Visceral / belly fat' },
  { id: 'joint_pain', label: 'Joint pain or weakness' },
  { id: 'back_pain', label: 'Back pain' },
  { id: 'fatigue', label: 'Chronic fatigue' },
  { id: 'poor_digestion', label: 'Poor digestion / acidity' },
  { id: 'stress_anxiety', label: 'Stress / anxiety' },
  { id: 'hair_fall', label: 'Hair fall / thinning' },
  { id: 'period_pain', label: 'Period pain / irregular cycles' },
  { id: 'pcos', label: 'PCOS / hormonal imbalance' },
  { id: 'low_immunity', label: 'Frequent illness / low immunity' },
  { id: 'skin_issues', label: 'Skin issues / acne' },
  { id: 'thyroid', label: 'Thyroid (hypo / hyper)' },
  { id: 'high_bp', label: 'High blood pressure' },
  { id: 'high_cholesterol', label: 'High cholesterol' },
  { id: 'diabetes_risk', label: 'Pre-diabetes / blood sugar' },
  { id: 'none', label: 'No major concerns' },
];

const FOOD_PREFS = [
  { id: 'north_indian', label: 'North Indian' },
  { id: 'south_indian', label: 'South Indian' },
  { id: 'bengali', label: 'Bengali / East Indian' },
  { id: 'gujarati', label: 'Gujarati / Rajasthani' },
  { id: 'maharashtrian', label: 'Maharashtrian' },
  { id: 'continental', label: 'Continental / Western' },
  { id: 'high_protein_snacks', label: 'High-protein snacks' },
  { id: 'quick_prep', label: 'Quick / low-effort meals' },
  { id: 'street_food_style', label: 'Street food style (healthy versions)' },
];

const emptyData: OnboardingData & { allergies: string[] } = {
  display_name: '',
  age: 0,
  weight_kg: 0,
  height_cm: 0,
  gender: '',
  fitness_goals: [],
  body_type: '',
  activity_level: '',
  diet_type: '',
  health_concerns: [],
  injuries: [],
  sleep_hours_current: 7,
  commitment_days_per_week: 3,
  preferred_workout_time: '',
  food_preferences: [],
  food_dislikes: [],
  goal_timeline_months: 6,
  medications: '',
  allergies: [],
};

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="w-full mb-8">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-500">Step {step} of {TOTAL_STEPS}</span>
        <span className="text-xs text-emerald-400 font-medium">{Math.round((step / TOTAL_STEPS) * 100)}% complete</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  );
}

function MultiSelect({ options, selected, onChange }: {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          onClick={() => toggle(opt.id)}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
            selected.includes(opt.id)
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

// Tag input: stores raw text, converts to array on comma/enter, allows full editing
function TagInput({
  label,
  tags,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  tags: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(value: string) {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function handleBlur() {
    if (inputValue.trim()) addTag(inputValue);
  }

  return (
    <div>
      <label className="text-sm font-medium text-gray-300 block mb-1.5">{label}</label>
      <div
        className="min-h-[42px] bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 flex flex-wrap gap-1.5 items-center focus-within:border-emerald-500 transition-colors cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-xs font-medium px-2 py-0.5 rounded-lg">
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(tags.filter((_, idx) => idx !== i)); }}
              className="text-emerald-400 hover:text-white transition-colors ml-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none min-w-[120px]"
        />
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

export function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData & { allergies: string[] }>(emptyData);
  const [loading, setLoading] = useState(false);
  const [prefilling, setPrefilling] = useState(true);
  const [error, setError] = useState('');
  const isEdit = profile?.onboarding_complete === true;

  // Pre-populate from existing health profile if re-doing onboarding
  useEffect(() => {
    if (!user) return;
    async function loadExisting() {
      const { data: hp } = await supabase.from('health_profiles').select('*').eq('user_id', user!.id).maybeSingle();
      const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', user!.id).maybeSingle();
      if (hp) {
        const injuries = (hp.injuries as string[]).filter(i => !i.startsWith('allergy: '));
        const allergies = (hp.injuries as string[]).filter(i => i.startsWith('allergy: ')).map(i => i.replace('allergy: ', ''));
        setData({
          display_name: prof?.display_name ?? '',
          age: hp.age ?? 0,
          weight_kg: hp.weight_kg ?? 0,
          height_cm: hp.height_cm ?? 0,
          gender: hp.gender ?? '',
          fitness_goals: hp.fitness_goals ?? [],
          body_type: hp.body_type ?? '',
          activity_level: hp.activity_level ?? '',
          diet_type: hp.diet_type ?? '',
          health_concerns: hp.health_concerns ?? [],
          injuries,
          allergies,
          sleep_hours_current: hp.sleep_hours_current ?? 7,
          commitment_days_per_week: hp.commitment_days_per_week ?? 3,
          preferred_workout_time: hp.preferred_workout_time ?? '',
          food_preferences: hp.food_preferences ?? [],
          food_dislikes: hp.food_dislikes ?? [],
          goal_timeline_months: hp.goal_timeline_months ?? 6,
          medications: hp.medications ?? '',
        });
      }
      setPrefilling(false);
    }
    loadExisting();
  }, [user]);

  function set<K extends keyof typeof data>(key: K, value: (typeof data)[K]) {
    setData(prev => ({ ...prev, [key]: value }));
  }

  function next() {
    setError('');
    if (!validateStep()) return;
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  }

  function back() {
    setError('');
    setStep(s => Math.max(s - 1, 1));
  }

  function validateStep(): boolean {
    if (step === 1 && (!data.display_name || !data.age || !data.weight_kg || !data.height_cm || !data.gender)) {
      setError('Please fill in all fields.'); return false;
    }
    if (step === 2 && data.fitness_goals.length === 0) {
      setError('Select at least one goal.'); return false;
    }
    if (step === 3 && (!data.body_type || !data.activity_level || !data.diet_type)) {
      setError('Please complete all fields.'); return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await supabase.from('profiles').update({ display_name: data.display_name }).eq('id', user.id);

      const injuriesWithAllergies = [
        ...data.injuries,
        ...data.allergies.map(a => `allergy: ${a}`),
      ];

      const { error: hpError } = await supabase.from('health_profiles').upsert({
        user_id: user.id,
        age: data.age,
        weight_kg: data.weight_kg,
        height_cm: data.height_cm,
        gender: data.gender,
        fitness_goals: data.fitness_goals,
        body_type: data.body_type,
        activity_level: data.activity_level,
        diet_type: data.diet_type,
        health_concerns: data.health_concerns,
        injuries: injuriesWithAllergies,
        medications: data.medications || null,
        sleep_hours_current: data.sleep_hours_current,
        commitment_days_per_week: data.commitment_days_per_week,
        preferred_workout_time: data.preferred_workout_time,
        food_preferences: data.food_preferences,
        food_dislikes: data.food_dislikes,
        goal_timeline_months: data.goal_timeline_months,
      }, { onConflict: 'user_id' });

      if (hpError) throw hpError;

      // onboarding_complete is set ONLY after plan generation succeeds (in GeneratePlanPage)
      navigate('/generate-plan');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
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

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          {isEdit && (
            <button
              onClick={() => navigate('/plan')}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-3 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to my plan
            </button>
          )}
          <div className="inline-flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-2">
            <Dumbbell className="w-4 h-4" />
            FitPath
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? 'Update your profile' : "Let's build your plan"}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {isEdit
              ? 'Change your details below — a new personalised plan will be generated.'
              : 'Answer honestly — the more detail, the better your plan'}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <ProgressBar step={step} />

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-5">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Who are you?</h2>
                <p className="text-sm text-gray-400 mb-5">Your basic stats power your personalised plan.</p>
              </div>
              <Input
                label="What should we call you?"
                value={data.display_name}
                onChange={e => set('display_name', e.target.value)}
                placeholder="Arjun"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Age"
                  type="number"
                  value={data.age || ''}
                  onChange={e => set('age', Number(e.target.value))}
                  placeholder="27"
                  min={16}
                  max={80}
                />
                <Select
                  label="Gender"
                  value={data.gender}
                  onChange={e => set('gender', e.target.value)}
                  options={[
                    { value: '', label: 'Select...' },
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other / prefer not to say' },
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
                  min={30}
                  max={250}
                />
                <Input
                  label="Height (cm)"
                  type="number"
                  value={data.height_cm || ''}
                  onChange={e => set('height_cm', Number(e.target.value))}
                  placeholder="168"
                  min={100}
                  max={250}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">What are your goals?</h2>
                <p className="text-sm text-gray-400 mb-5">Pick all that apply. Be greedy — more goals = smarter plan.</p>
              </div>
              <MultiSelect
                options={FITNESS_GOALS}
                selected={data.fitness_goals}
                onChange={v => set('fitness_goals', v)}
              />
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Timeline to achieve your goals</label>
                <div className="flex gap-2 flex-wrap">
                  {[3, 6, 9, 12].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set('goal_timeline_months', m)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
                        data.goal_timeline_months === m
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      {m} months
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Your lifestyle</h2>
                <p className="text-sm text-gray-400 mb-5">Honest answers only — this shapes your starting point.</p>
              </div>
              <Select
                label="Current activity level (day-to-day)"
                value={data.activity_level}
                onChange={e => set('activity_level', e.target.value)}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'sedentary', label: 'Sedentary (desk job, minimal movement)' },
                  { value: 'lightly_active', label: 'Lightly active (occasional walks, light chores)' },
                  { value: 'moderately_active', label: 'Moderately active (some exercise 1-3×/week)' },
                  { value: 'very_active', label: 'Very active (regular training 4+ days/week)' },
                  { value: 'athlete', label: 'Athlete / highly trained' },
                ]}
              />
              <Select
                label="Body type (how you'd describe yourself now)"
                value={data.body_type}
                onChange={e => set('body_type', e.target.value)}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'thin_low_muscle', label: 'Thin / skinny — low muscle and fat' },
                  { value: 'skinny_fat', label: 'Skinny-fat — thin but soft / low muscle' },
                  { value: 'lean_fit', label: 'Lean & fit — low fat, decent muscle' },
                  { value: 'athletic_muscular', label: 'Athletic / muscular build' },
                  { value: 'average_some_fat', label: 'Average — some fat, average muscle' },
                  { value: 'belly_fat', label: 'Noticeable belly fat / central obesity' },
                  { value: 'overweight', label: 'Overweight overall (fat all around)' },
                  { value: 'bulky_high_fat', label: 'Bulky — high muscle but also high fat' },
                  { value: 'previously_athletic', label: 'Previously athletic, regained fat' },
                ]}
              />
              <Select
                label="Diet type"
                value={data.diet_type}
                onChange={e => set('diet_type', e.target.value)}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'veg', label: 'Vegetarian (no eggs, no meat)' },
                  { value: 'veg_eggs', label: 'Vegetarian + Eggs (Eggetarian)' },
                  { value: 'veg_eggs_occasional_chicken', label: 'Veg + Eggs + Occasional chicken' },
                  { value: 'non_veg', label: 'Non-vegetarian (all foods)' },
                  { value: 'jain', label: 'Jain (no root vegetables, no eggs/meat)' },
                  { value: 'sattvic', label: 'Sattvic (no onion, no garlic, no meat)' },
                  { value: 'vegan', label: 'Vegan (no dairy, no eggs, no meat)' },
                  { value: 'keto_low_carb', label: 'Keto / Low-carb' },
                  { value: 'intermittent_fasting', label: 'Intermittent fasting (16:8 or similar)' },
                ]}
              />
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Workout style & frequency</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 0, label: 'No exercise currently' },
                    { value: 1, label: 'Home workout (1-2×/week)' },
                    { value: 2, label: 'Home workout (3-4×/week)' },
                    { value: 3, label: 'Light yoga / walking' },
                    { value: 4, label: 'Power yoga / functional' },
                    { value: 5, label: 'Gym (3×/week)' },
                    { value: 6, label: 'Gym (4-5×/week)' },
                    { value: 7, label: 'Sports / outdoor activity' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('commitment_days_per_week', opt.value)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 text-left ${
                        data.commitment_days_per_week === opt.value
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <Select
                label="Preferred workout time"
                value={data.preferred_workout_time}
                onChange={e => set('preferred_workout_time', e.target.value)}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'early_morning', label: 'Early morning (5-7am)' },
                  { value: 'morning', label: 'Morning (7-9am)' },
                  { value: 'afternoon', label: 'Afternoon (12-3pm)' },
                  { value: 'evening', label: 'Evening (5-8pm)' },
                  { value: 'night', label: 'Night (after 8pm)' },
                  { value: 'flexible', label: 'Flexible / no preference' },
                ]}
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Health concerns & limitations</h2>
                <p className="text-sm text-gray-400 mb-5">Even minor issues matter — they shape your plan and prevent aggravating them.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Current health concerns</label>
                <MultiSelect
                  options={HEALTH_CONCERNS}
                  selected={data.health_concerns}
                  onChange={v => set('health_concerns', v)}
                />
              </div>
              <TagInput
                label="Injuries or physical limitations (optional)"
                tags={data.injuries}
                onChange={v => set('injuries', v)}
                placeholder="e.g. left knee pain"
                hint="Type and press Enter or comma to add each item"
              />
              <TagInput
                label="Food allergies (optional)"
                tags={data.allergies}
                onChange={v => set('allergies', v)}
                placeholder="e.g. peanuts, lactose, gluten"
                hint="Type and press Enter or comma to add each allergy"
              />
              <Input
                label="Current medications or supplements (optional)"
                value={data.medications}
                onChange={e => set('medications', e.target.value)}
                placeholder="e.g. Thyronorm 50mcg, Vitamin D3"
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Sleep & energy</h2>
                <p className="text-sm text-gray-400 mb-5">Sleep is the foundation of every fitness goal. Be honest here.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">
                  How many hours do you currently sleep per night? <span className="text-emerald-400 font-semibold">{data.sleep_hours_current}h</span>
                </label>
                <input
                  type="range"
                  min={4}
                  max={12}
                  step={0.5}
                  value={data.sleep_hours_current}
                  onChange={e => set('sleep_hours_current', Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>4h</span><span>8h (ideal)</span><span>12h</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300 mb-2">How's your current energy level through the day?</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'very_low', label: 'Very low — exhausted by noon' },
                    { value: 'low', label: 'Low — afternoon crashes' },
                    { value: 'moderate', label: 'Moderate — manageable' },
                    { value: 'good', label: 'Good — mostly energetic' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('activity_level', opt.value)}
                      className={`px-3 py-2 rounded-xl text-sm border transition-all duration-200 text-left ${
                        data.activity_level === opt.value
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
          )}

          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Food preferences</h2>
                <p className="text-sm text-gray-400 mb-5">So your meal plan actually feels like food you enjoy eating.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Cuisines you enjoy</label>
                <MultiSelect
                  options={FOOD_PREFS}
                  selected={data.food_preferences}
                  onChange={v => set('food_preferences', v)}
                />
              </div>
              <TagInput
                label="Foods you dislike or can't eat (optional)"
                tags={data.food_dislikes}
                onChange={v => set('food_dislikes', v)}
                placeholder="e.g. broccoli, mushrooms"
                hint="Type and press Enter or comma to add each item"
              />
            </div>
          )}

          {step === 7 && (
            <div className="space-y-5">
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-4">
                  <Sparkles className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">You're all set!</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                  We have everything we need to build your personalised Phase 1 plan covering workouts, diet, supplements, habits, and sleep protocol.
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Name</span>
                  <span className="text-white font-medium">{data.display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Stats</span>
                  <span className="text-white font-medium">{data.age}y, {data.weight_kg}kg, {data.height_cm}cm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Diet</span>
                  <span className="text-white font-medium capitalize">{data.diet_type?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Workout style</span>
                  <span className="text-white font-medium">{data.commitment_days_per_week === 0 ? 'No exercise yet' : `${data.commitment_days_per_week} days/week`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Goals</span>
                  <span className="text-white font-medium">{data.fitness_goals.length} selected</span>
                </div>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                <p className="text-xs text-amber-300/80 text-center">
                  Your plan is generated by AI and is for general guidance only. Always consult a doctor before starting a new diet or exercise programme.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <Button variant="secondary" onClick={back} className="flex-1">
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            {step < TOTAL_STEPS ? (
              <Button onClick={next} className="flex-1">
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} loading={loading} className="flex-1" size="lg">
                <Sparkles className="w-4 h-4" />
                Generate my plan
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
