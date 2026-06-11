import { z } from 'zod';
import type { HomeDetails } from '../../types';
import type { ModalityDefinition } from './types';
import { MODALITY_PROMPT_INFO } from './shared';

export const homeModality: ModalityDefinition<HomeDetails> = {
  ...MODALITY_PROMPT_INFO.home,
  description: 'Effective training with no gym required',
  icon: '🏠',
  stepHeader: {
    title: 'Home Workout',
    subtitle: 'Your plan is built entirely around what you have available — no gym required.',
  },
  schema: z.object({
    equipment: z.array(z.string()),
    space: z.string(),
    fitness_level: z.enum(['beginner', 'intermediate', 'advanced']),
    primary_focus: z.array(z.string()),
  }),
  uiFields: [
    {
      key: 'equipment',
      kind: 'multiselect',
      label: 'Equipment you have at home',
      options: [
        { value: 'none', label: 'None (bodyweight only)' },
        { value: 'resistance_bands', label: 'Resistance bands' },
        { value: 'dumbbells', label: 'Dumbbells' },
        { value: 'pullup_bar', label: 'Pull-up bar' },
        { value: 'kettlebell', label: 'Kettlebell' },
        { value: 'yoga_mat', label: 'Yoga mat' },
        { value: 'jump_rope', label: 'Jump rope' },
      ],
    },
    {
      key: 'fitness_level',
      kind: 'radio',
      label: 'Your fitness level',
      visibleIf: ctx => !ctx.activityModalities.includes('gym'),
      required: ctx => !ctx.activityModalities.includes('gym'),
      requiredMessage: 'Please select your current fitness level.',
      options: [
        { value: 'beginner', label: 'Beginner', description: 'New to structured training' },
        { value: 'intermediate', label: 'Intermediate', description: '6+ months of consistent exercise' },
        { value: 'advanced', label: 'Advanced', description: '2+ years of regular training' },
      ],
    },
    {
      key: 'primary_focus',
      kind: 'multiselect',
      label: 'Primary focus',
      labelNote: '— up to 2',
      max: 2,
      visibleIf: ctx => !ctx.activityModalities.includes('gym'),
      required: ctx => !ctx.activityModalities.includes('gym'),
      requiredMessage: 'Please select at least one focus area.',
      options: [
        { value: 'build_muscle', label: 'Build muscle' },
        { value: 'lose_fat', label: 'Lose fat' },
        { value: 'improve_strength', label: 'Get stronger' },
        { value: 'improve_flexibility', label: 'Improve flexibility' },
        { value: 'prepare_long_term', label: 'General fitness' },
      ],
    },
    {
      key: 'gym_note',
      kind: 'info',
      label: 'Fitness level and focus are already captured from your Gym Workout answers.',
      visibleIf: ctx => ctx.activityModalities.includes('gym'),
    },
  ],
};
