import { z } from 'zod';
import type { SupplementDetails } from '../../types';
import type { ModalityDefinition } from './types';
import { MODALITY_PROMPT_INFO } from './shared';
import { getSupplementBudgetOptions } from '../countries/currencies';

export const supplementsModality: ModalityDefinition<SupplementDetails> = {
  ...MODALITY_PROMPT_INFO.supplements,
  description: 'Targeted, region-available supplement guidance',
  icon: '💊',
  stepHeader: {
    title: 'Supplements',
    subtitle: 'We recommend only what you actually need — nothing unnecessary, all available in your region.',
  },
  schema: z.object({
    current: z.array(z.string()),
    goals: z.array(z.string()).min(1).max(3),
    budget: z.enum(['under_500', '500_1500', '1500_3000', 'no_limit']),
    veg_preferred: z.boolean(),
  }),
  uiFields: [
    {
      key: 'current',
      kind: 'multiselect',
      label: 'Supplements you currently take',
      labelNote: '— select all that apply',
      options: [
        { value: 'protein_powder', label: 'Protein powder' },
        { value: 'creatine', label: 'Creatine' },
        { value: 'multivitamin', label: 'Multivitamin' },
        { value: 'omega3', label: 'Omega-3' },
        { value: 'vitamin_d', label: 'Vitamin D' },
        { value: 'iron', label: 'Iron' },
        { value: 'b12', label: 'B12' },
        { value: 'pre_workout', label: 'Pre-workout' },
        { value: 'nothing', label: 'Nothing currently' },
      ],
    },
    {
      key: 'goals',
      kind: 'multiselect',
      label: 'What do you want supplements to help with?',
      labelNote: '— up to 3',
      max: 3,
      required: true,
      requiredMessage: 'Please select at least one supplement goal.',
      options: [
        { value: 'fill_gaps', label: 'Fill nutritional gaps' },
        { value: 'muscle_growth', label: 'Muscle growth' },
        { value: 'energy', label: 'Energy & performance' },
        { value: 'hair_skin', label: 'Hair, skin & nails' },
        { value: 'immunity', label: 'Immunity' },
        { value: 'hormonal', label: 'Hormonal support (PCOS/thyroid)' },
        { value: 'recovery', label: 'Recovery & joint health' },
      ],
    },
    {
      key: 'budget',
      kind: 'radio',
      label: 'Monthly supplement budget',
      required: true,
      requiredMessage: 'Please select your monthly supplement budget.',
      options: ctx => getSupplementBudgetOptions(ctx.country),
    },
    {
      key: 'veg_preferred',
      kind: 'buttongrid',
      label: 'Preference for vegetarian-certified supplements',
      cols: 2,
      valueType: 'boolean',
      options: [
        { value: 'yes', label: 'Yes, strictly veg' },
        { value: 'no', label: 'No preference' },
      ],
    },
  ],
};
