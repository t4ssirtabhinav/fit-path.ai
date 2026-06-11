import { z } from 'zod';
import type { YogaDetails } from '../../types';
import type { ModalityDefinition } from './types';
import { MODALITY_PROMPT_INFO } from './shared';

export const yogaModality: ModalityDefinition<YogaDetails> = {
  ...MODALITY_PROMPT_INFO.yoga,
  description: 'Flexibility, mindfulness, and mind-body connection',
  icon: '🧘',
  stepHeader: {
    title: 'Yoga',
    subtitle: 'Your plan varies a lot by style and goal — these questions ensure yours is right.',
  },
  schema: z.object({
    experience: z.enum(['beginner', 'tried_few', 'regular', 'established']),
    session_duration: z.enum(['15_20min', '30_45min', '60min']),
    goals: z.array(z.string()).min(1).max(2),
    style: z.enum(['not_sure', 'hatha', 'vinyasa', 'yin', 'power']),
  }),
  uiFields: [
    {
      key: 'experience',
      kind: 'radio',
      label: 'Your yoga experience',
      required: true,
      requiredMessage: 'Please tell us about your yoga experience.',
      options: [
        { value: 'beginner', label: 'Complete beginner' },
        { value: 'tried_few', label: 'Tried a few times' },
        { value: 'regular', label: 'Regular (3–12 months)' },
        { value: 'established', label: 'Established practice (1+ year)' },
      ],
    },
    {
      key: 'session_duration',
      kind: 'buttongrid',
      label: 'Session duration you can commit to',
      cols: 3,
      options: [
        { value: '15_20min', label: '15–20 min' },
        { value: '30_45min', label: '30–45 min' },
        { value: '60min', label: '60+ min' },
      ],
    },
    {
      key: 'goals',
      kind: 'multiselect',
      label: 'What are you hoping yoga does for you?',
      labelNote: '— up to 2',
      max: 2,
      required: true,
      requiredMessage: 'Please select at least one yoga goal.',
      options: [
        { value: 'improve_flexibility', label: 'Improve flexibility' },
        { value: 'reduce_stress', label: 'Reduce stress & anxiety' },
        { value: 'complement_gym', label: 'Complement gym training' },
        { value: 'back_posture', label: 'Back / posture relief' },
        { value: 'body_awareness', label: 'Body awareness' },
        { value: 'build_strength', label: 'Build strength' },
      ],
    },
    {
      key: 'style',
      kind: 'radio',
      label: 'Style preference',
      options: [
        { value: 'not_sure', label: 'Not sure — let the plan decide' },
        { value: 'hatha', label: 'Hatha', description: 'Slow, foundational, beginner-friendly' },
        { value: 'vinyasa', label: 'Vinyasa', description: 'Flowing sequences, moderate intensity' },
        { value: 'yin', label: 'Yin', description: 'Deep passive stretching, held poses' },
        { value: 'power', label: 'Power yoga', description: 'Strength-based, athletic approach' },
      ],
    },
  ],
};
