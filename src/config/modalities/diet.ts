import { z } from 'zod';
import type { DietDetails } from '../../types';
import type { ModalityDefinition } from './types';
import { MODALITY_PROMPT_INFO } from './shared';
import { getCuisineOptions } from '../countries/cuisines';

export const dietModality: ModalityDefinition<DietDetails> = {
  ...MODALITY_PROMPT_INFO.diet,
  description: 'Personalized meal planning and nutrition guidance',
  icon: '🥗',
  stepHeader: ctx => ({
    title: 'Diet & Nutrition',
    subtitle: `Your meal plan uses ${ctx.country ? `real ${ctx.country} ingredients` : 'ingredients available where you live'} and your exact preferences — not generic advice.`,
  }),
  schema: z.object({
    diet_type: z.enum(['veg', 'veg_eggs', 'veg_eggs_occasional_chicken', 'non_veg', 'jain', 'sattvic', 'vegan']),
    dietary_goal: z.enum(['lose_weight', 'gain_weight', 'general', 'condition_management']),
    cuisine_style: z.array(z.string()),
    allergies: z.array(z.string()),
    food_dislikes: z.array(z.string()),
    conditions: z.array(z.string()),
  }),
  uiFields: [
    {
      key: 'diet_type',
      kind: 'radio',
      label: 'Your diet type',
      required: true,
      requiredMessage: 'Please select your diet type.',
      options: [
        { value: 'veg', label: 'Vegetarian (no eggs, no meat)' },
        { value: 'veg_eggs', label: 'Vegetarian + Eggs' },
        { value: 'veg_eggs_occasional_chicken', label: 'Veg + Eggs + Occasional chicken' },
        { value: 'non_veg', label: 'Non-vegetarian (all foods)' },
        { value: 'jain', label: 'Jain (no root vegetables)' },
        { value: 'sattvic', label: 'Sattvic (no onion / garlic / meat)' },
        { value: 'vegan', label: 'Vegan' },
      ],
    },
    {
      key: 'dietary_goal',
      kind: 'radio',
      label: 'Main dietary goal',
      required: true,
      requiredMessage: 'Please select your main dietary goal.',
      options: [
        { value: 'lose_weight', label: 'Lose weight' },
        { value: 'gain_weight', label: 'Gain weight / build muscle' },
        { value: 'general', label: 'Maintain weight, improve quality' },
        { value: 'condition_management', label: 'Manage a health condition' },
      ],
    },
    {
      key: 'conditions',
      kind: 'multiselect',
      label: 'Which condition(s)?',
      visibleIf: ctx => ctx.goalDetails.diet?.dietary_goal === 'condition_management',
      options: [
        { value: 'diabetes', label: 'Diabetes / blood sugar' },
        { value: 'pcos', label: 'PCOS / hormonal' },
        { value: 'thyroid', label: 'Thyroid' },
        { value: 'high_bp', label: 'High blood pressure' },
        { value: 'cholesterol', label: 'High cholesterol' },
        { value: 'ibs', label: 'IBS / digestive issues' },
      ],
    },
    {
      key: 'cuisine_style',
      kind: 'multiselect',
      label: 'Cuisine style',
      labelNote: '— select all you enjoy',
      options: ctx => getCuisineOptions(ctx.country).map(o => ({ value: o.id, label: o.label })),
    },
    {
      key: 'allergies',
      kind: 'tags',
      label: 'Food allergies',
      optional: true,
      placeholder: 'e.g. peanuts, lactose, gluten',
      helperText: 'Press Enter or comma after each item',
    },
    {
      key: 'food_dislikes',
      kind: 'tags',
      label: 'Foods you strongly dislike',
      optional: true,
      placeholder: 'e.g. broccoli, mushrooms',
      helperText: 'Press Enter or comma after each item',
    },
  ],
};
