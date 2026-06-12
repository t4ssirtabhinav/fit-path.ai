import { z } from 'zod';
import type { ConcernsDetails } from '../../types';
import type { ModalityDefinition } from './types';
import { MODALITY_PROMPT_INFO } from './shared';

const ALL_CONCERNS = [
  { value: 'Stress / anxiety', label: 'Stress / anxiety' },
  { value: 'Sleep quality', label: 'Sleep quality' },
  { value: 'Hair fall / thinning', label: 'Hair fall / thinning' },
  { value: 'Skin concerns', label: 'Skin concerns / acne' },
  { value: 'PCOS / hormonal imbalance', label: 'PCOS / hormonal imbalance' },
  { value: 'Thyroid', label: 'Thyroid (hypo/hyper)' },
  { value: 'Diabetes risk / blood sugar', label: 'Diabetes risk / blood sugar' },
  { value: 'High blood pressure', label: 'High blood pressure' },
  { value: 'High cholesterol', label: 'High cholesterol' },
  { value: 'Digestive issues', label: 'Digestive issues / acidity' },
  { value: 'Low immunity', label: 'Low immunity / frequent illness' },
  { value: 'Chronic fatigue / low energy', label: 'Chronic fatigue / low energy' },
  { value: 'Posture & back pain', label: 'Posture & back pain' },
  { value: 'Menstrual health', label: 'Menstrual health' },
];

export const concernsModality: ModalityDefinition<ConcernsDetails> = {
  ...MODALITY_PROMPT_INFO.concerns,
  description: 'PCOS, thyroid, BP, immunity, hair, skin & more',
  icon: '➕',
  tag: 'Add-on',
  stepHeader: {
    title: 'Other Health Concerns',
    subtitle: 'These get woven into your plan as targeted nutrition, habit, and lifestyle adjustments — not a separate programme.',
  },
  schema: z.object({
    items: z.array(z.string()).min(1),
    on_medication: z.enum(['yes_some', 'no', 'prefer_not_say']),
  }),
  uiFields: [
    {
      key: 'items',
      kind: 'multiselect',
      label: 'Your concerns',
      required: true,
      requiredMessage: 'Please select at least one health concern.',
      options: ctx => [...ALL_CONCERNS].sort((a) => {
        if (ctx.gender === 'female' && (a.value === 'PCOS / hormonal imbalance' || a.value === 'Menstrual health')) return -1;
        if (ctx.age > 45 && (a.value === 'High blood pressure' || a.value === 'Diabetes risk / blood sugar' || a.value === 'High cholesterol')) return -1;
        if (ctx.age < 25 && (a.value === 'Skin concerns' || a.value === 'Hair fall / thinning')) return -1;
        return 0;
      }),
    },
    {
      key: 'on_medication',
      kind: 'radio',
      label: 'Are you currently on medication for any of these?',
      options: [
        { value: 'yes_some', label: 'Yes, for some of them' },
        { value: 'no', label: 'No' },
        { value: 'prefer_not_say', label: 'Prefer not to say' },
      ],
    },
  ],
};
