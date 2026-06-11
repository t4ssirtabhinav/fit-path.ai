import { z } from 'zod';
import type { GymDetails } from '../../types';
import type { ModalityDefinition } from './types';
import { MODALITY_PROMPT_INFO } from './shared';

const LOW_EXPERIENCE = ['never', 'beginner'];

export const gymModality: ModalityDefinition<GymDetails> = {
  ...MODALITY_PROMPT_INFO.gym,
  description: 'Structured training with weights and machines',
  icon: '🏋️',
  stepHeader: {
    title: 'Gym Workout',
    subtitle: 'This shapes your split, load progression, and weekly structure.',
  },
  schema: z.object({
    experience: z.enum(['never', 'beginner', 'intermediate', 'advanced', 'experienced']),
    equipment: z.enum(['full_gym', 'home_gym', 'minimal', 'bodyweight']),
    days_per_week: z.number().int().min(2).max(6),
    primary_focus: z.array(z.string()).min(1).max(3),
  }),
  uiFields: [
    {
      key: 'experience',
      kind: 'radio',
      label: 'How long have you been training consistently?',
      required: true,
      requiredMessage: 'Please tell us about your gym experience.',
      options: [
        { value: 'never', label: 'Never started' },
        { value: 'beginner', label: '< 3 months — Beginner' },
        { value: 'intermediate', label: '3–12 months — Intermediate' },
        { value: 'advanced', label: '1–3 years — Advanced' },
        { value: 'experienced', label: '3+ years — Experienced' },
      ],
    },
    {
      key: 'equipment',
      kind: 'radio',
      label: 'Equipment access',
      required: true,
      requiredMessage: 'Please select your equipment access.',
      options: [
        { value: 'full_gym', label: 'Full gym membership' },
        { value: 'home_gym', label: 'Home gym (dumbbells, rack)' },
        { value: 'minimal', label: 'Minimal (bands, dumbbells only)' },
        { value: 'bodyweight', label: 'Bodyweight only' },
      ],
    },
    {
      key: 'days_per_week',
      kind: 'buttongrid',
      label: 'Training days per week',
      required: true,
      requiredMessage: 'Please select how many days per week you can train.',
      valueType: 'number',
      cols: ctx => (LOW_EXPERIENCE.includes(ctx.goalDetails.gym?.experience ?? '') ? 4 : 6),
      options: ctx => (LOW_EXPERIENCE.includes(ctx.goalDetails.gym?.experience ?? '')
        ? [2, 3, 4, 5].map(n => ({ value: String(n), label: `${n} days` }))
        : [2, 3, 4, 5, 6].map(n => ({ value: String(n), label: String(n) }))),
      helperText: ctx => (LOW_EXPERIENCE.includes(ctx.goalDetails.gym?.experience ?? '')
        ? 'We recommend easing in with fewer sessions initially.'
        : undefined),
    },
    {
      key: 'primary_focus',
      kind: 'multiselect',
      label: 'Primary focus',
      labelNote: '— pick up to 3',
      max: 3,
      required: true,
      requiredMessage: 'Please select at least one focus area.',
      options: [
        { value: 'build_muscle', label: 'Build muscle' },
        { value: 'lose_fat', label: 'Lose fat' },
        { value: 'improve_strength', label: 'Get stronger' },
        { value: 'improve_endurance', label: 'Endurance' },
        { value: 'improve_flexibility', label: 'Flexibility' },
        { value: 'tone_body', label: 'Tone & define' },
        { value: 'prepare_long_term', label: 'General fitness' },
      ],
    },
  ],
};
