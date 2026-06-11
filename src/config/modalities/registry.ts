import type { GoalModality } from '../../types';
import type { ModalityDefinition } from './types';
import { gymModality } from './gym';
import { yogaModality } from './yoga';
import { cardioModality } from './cardio';
import { homeModality } from './home';

// Populated incrementally as each modality is migrated (Phase 2, steps 2c-2j).
// Once complete, GOAL_MODALITIES/MODALITY_ORDER in OnboardingPage.tsx will be
// derived from this registry (step 2k).
export const MODALITY_REGISTRY: Partial<Record<GoalModality, ModalityDefinition<any>>> = {
  gym: gymModality,
  yoga: yogaModality,
  cardio: cardioModality,
  home: homeModality,
};
