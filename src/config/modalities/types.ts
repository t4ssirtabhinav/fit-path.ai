import type { z } from 'zod';
import type { GoalDetails, GoalModality } from '../../types';
import type { PromptModalityInfo } from './shared';

export interface ModalityOption {
  value: string;
  label: string;
  description?: string;
}

/** Context available to options/visibility/requiredness functions for a field. */
export interface FieldRenderCtx {
  age: number;
  gender: string;
  weight_kg: number;
  height_cm: number;
  bmi: number;
  activityModalities: GoalModality[];
  goalDetails: GoalDetails;
}

export type ModalityFieldKind = 'radio' | 'multiselect' | 'buttongrid' | 'tags' | 'stresspicker' | 'info';

export interface ModalityFieldDef<TDetails> {
  /** For 'info' fields (which store no value), any unique string id. */
  key: (keyof TDetails & string) | (string & {});
  kind: ModalityFieldKind;
  label: string;
  /** Extra inline note rendered next to the label (e.g. "— pick up to 3"). */
  labelNote?: string;
  optional?: boolean;
  /** Max selections, for 'multiselect'. */
  max?: number;
  /** Grid columns, for 'buttongrid'. Can depend on context (e.g. gym days_per_week). */
  cols?: number | ((ctx: FieldRenderCtx) => number);
  options?: ModalityOption[] | ((ctx: FieldRenderCtx) => ModalityOption[]);
  visibleIf?: (ctx: FieldRenderCtx) => boolean;
  required?: boolean | ((ctx: FieldRenderCtx) => boolean);
  requiredMessage?: string;
  helperText?: string | ((ctx: FieldRenderCtx) => string | undefined);
  /** When set to 'number', values from radio/buttongrid/etc are coerced with Number() before storing. */
  valueType?: 'string' | 'number';
}

export interface ModalityDefinition<TDetails> extends PromptModalityInfo {
  description: string;
  icon: string;
  tag?: string;
  /** Optional banner (e.g. medical disclaimer) rendered above the step header. */
  disclaimer?: string;
  stepHeader: { title: string; subtitle: string } | ((ctx: FieldRenderCtx) => { title: string; subtitle: string });
  schema: z.ZodType<TDetails>;
  uiFields: ModalityFieldDef<TDetails>[];
}
