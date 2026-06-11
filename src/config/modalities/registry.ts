import type { GoalModality } from '../../types';
import type { FieldRenderCtx, ModalityDefinition } from './types';
import { gymModality } from './gym';
import { yogaModality } from './yoga';
import { cardioModality } from './cardio';
import { homeModality } from './home';
import { physioModality } from './physio';
import { dietModality } from './diet';
import { supplementsModality } from './supplements';
import { concernsModality } from './concerns';

export const MODALITY_REGISTRY: Record<GoalModality, ModalityDefinition<any>> = {
  gym: gymModality,
  yoga: yogaModality,
  cardio: cardioModality,
  home: homeModality,
  physio: physioModality,
  diet: dietModality,
  supplements: supplementsModality,
  concerns: concernsModality,
};

export const MODALITY_ORDER: GoalModality[] = ['gym', 'yoga', 'cardio', 'home', 'physio', 'diet', 'supplements', 'concerns'];

const DEFAULT_CTX: FieldRenderCtx = {
  age: 0, gender: '', weight_kg: 0, height_cm: 0, bmi: 0, country: '', activityModalities: [], goalDetails: {},
};

export const GOAL_MODALITIES: { id: GoalModality; label: string; description: string; icon: string; tag?: string }[] =
  MODALITY_ORDER.map(id => {
    const def = MODALITY_REGISTRY[id];
    const header = typeof def.stepHeader === 'function' ? def.stepHeader(DEFAULT_CTX) : def.stepHeader;
    return { id, label: header.title, description: def.description, icon: def.icon, tag: def.tag };
  });
