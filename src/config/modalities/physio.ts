import { z } from 'zod';
import type { PhysioDetails } from '../../types';
import type { ModalityDefinition } from './types';
import { MODALITY_PROMPT_INFO } from './shared';

export const physioModality: ModalityDefinition<PhysioDetails> = {
  ...MODALITY_PROMPT_INFO.physio,
  description: 'Injury recovery, pain management, and mobility',
  icon: '🩹',
  disclaimer: "FitPath's recovery guidance is informational only and not a substitute for professional medical advice. Always follow your healthcare provider's instructions.",
  stepHeader: {
    title: 'Physiotherapy & Recovery',
    subtitle: 'These questions keep your plan safe and focused on what your body actually needs right now.',
  },
  schema: z.object({
    reason: z.enum(['recovering_injury', 'chronic_pain', 'post_surgery', 'preventing', 'mobility', 'maintenance']),
    areas: z.array(z.string()).min(1).max(3),
    duration: z.enum(['recent', 'few_months', 'chronic', 'post_surgery']),
    has_professional: z.enum(['yes_active', 'no', 'was_not_now']),
  }),
  uiFields: [
    {
      key: 'reason',
      kind: 'radio',
      label: 'Why did you select this?',
      required: true,
      requiredMessage: 'Please tell us why you selected physiotherapy & recovery.',
      options: [
        { value: 'recovering_injury', label: 'Recovering from an injury' },
        { value: 'chronic_pain', label: 'Managing chronic pain' },
        { value: 'post_surgery', label: 'Post-surgery rehabilitation' },
        { value: 'preventing', label: 'Preventing a recurring problem' },
        { value: 'mobility', label: 'Improving mobility & range of motion' },
        { value: 'maintenance', label: 'Athletic recovery & maintenance' },
      ],
    },
    {
      key: 'areas',
      kind: 'multiselect',
      label: 'Focus areas',
      labelNote: '— up to 3',
      max: 3,
      required: true,
      requiredMessage: 'Please select at least one area to focus on.',
      options: [
        { value: 'lower_back', label: 'Lower back' },
        { value: 'neck', label: 'Neck / upper back' },
        { value: 'shoulders', label: 'Shoulders' },
        { value: 'knees', label: 'Knees' },
        { value: 'hips', label: 'Hips' },
        { value: 'ankles', label: 'Ankles / feet' },
        { value: 'wrists', label: 'Wrists / elbows' },
        { value: 'core', label: 'Core' },
      ],
    },
    {
      key: 'duration',
      kind: 'radio',
      label: 'How long has this been an issue?',
      required: true,
      requiredMessage: 'Please select how long this has been an issue.',
      options: [
        { value: 'recent', label: 'Recent (< 1 month)' },
        { value: 'few_months', label: 'A few months' },
        { value: 'chronic', label: 'Chronic (6+ months)' },
        { value: 'post_surgery', label: 'Post-surgery' },
      ],
      helperText: ctx => ctx.goalDetails.physio?.duration === 'post_surgery'
        ? "We'll only include gentle mobility work. Validate with your surgeon before starting."
        : undefined,
    },
    {
      key: 'has_professional',
      kind: 'radio',
      label: 'Are you currently working with a physio or doctor?',
      options: [
        { value: 'yes_active', label: 'Yes, actively in treatment' },
        { value: 'no', label: 'No, self-managing' },
        { value: 'was_not_now', label: 'I was, but not currently' },
      ],
    },
  ],
};
