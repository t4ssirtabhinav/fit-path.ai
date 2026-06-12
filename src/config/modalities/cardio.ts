import { z } from 'zod';
import type { CardioDetails } from '../../types';
import type { ModalityDefinition } from './types';
import { MODALITY_PROMPT_INFO } from './shared';

export const cardioModality: ModalityDefinition<CardioDetails> = {
  ...MODALITY_PROMPT_INFO.cardio,
  description: 'Endurance, heart health, and calorie burn',
  icon: '🏃',
  stepHeader: {
    title: 'Walking / Running / Cardio',
    subtitle: "Cardio is paced to your current baseline so it's challenging but sustainable.",
  },
  schema: z.object({
    baseline: z.enum(['rarely_move', 'casual_walking', 'brisk_walk', 'running', 'sports_hiit']),
    activities: z.array(z.string()),
    goal: z.enum(['lose_fat', 'endurance', 'heart_health', 'stress', 'event', 'complement']),
    days_per_week: z.number().int(),
  }),
  uiFields: [
    {
      key: 'baseline',
      kind: 'radio',
      label: 'Current cardio baseline',
      required: true,
      requiredMessage: 'Please describe your current cardio baseline.',
      options: [
        { value: 'rarely_move', label: 'I rarely move much' },
        { value: 'casual_walking', label: 'Casual walking (< 30 min/day)' },
        { value: 'brisk_walk', label: 'Brisk walking / occasional jog' },
        { value: 'running', label: 'Running with a regular pace / distance' },
        { value: 'sports_hiit', label: 'Sports or HIIT training regularly' },
      ],
    },
    {
      key: 'activities',
      kind: 'multiselect',
      label: 'Activities you prefer',
      options: [
        { value: 'walking', label: 'Walking' },
        { value: 'jogging', label: 'Jogging' },
        { value: 'running', label: 'Running' },
        { value: 'cycling', label: 'Cycling' },
        { value: 'swimming', label: 'Swimming' },
        { value: 'hiit', label: 'HIIT / Circuit' },
        { value: 'jump_rope', label: 'Jump rope' },
      ],
      helperText: ctx => {
        if (ctx.age > 55) return 'Low-impact options like walking and cycling are highlighted for your age group.';
        if (ctx.bmi > 30) return "We'll ease you in with walk-run intervals based on your BMI.";
        return undefined;
      },
    },
    {
      key: 'goal',
      kind: 'radio',
      label: 'Main goal',
      required: true,
      requiredMessage: 'Please select your main cardio goal.',
      options: [
        { value: 'lose_fat', label: 'Lose weight / burn fat' },
        { value: 'endurance', label: 'Build stamina & endurance' },
        { value: 'heart_health', label: 'Heart health & longevity' },
        { value: 'stress', label: 'Stress relief' },
        { value: 'event', label: 'Train for an event (5K, 10K…)' },
        { value: 'complement', label: 'Complement strength training' },
      ],
    },
    {
      key: 'days_per_week',
      kind: 'buttongrid',
      label: 'Days per week',
      cols: 4,
      valueType: 'number',
      options: [
        { value: '2', label: '2 days' },
        { value: '3', label: '3 days' },
        { value: '4', label: '4 days' },
        { value: '5', label: '5 days' },
      ],
    },
  ],
};
