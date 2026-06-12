import type { GoalDetails, GoalModality, OnboardingData } from '../../types';
import type { FieldRenderCtx, ModalityFieldDef } from '../../config/modalities/types';
import { MODALITY_REGISTRY } from '../../config/modalities/registry';
import { StepHeader } from './StepHeader';
import { FieldLabel } from './FieldLabel';
import { RadioCards } from './RadioCards';
import { MultiSelectChips } from './MultiSelectChips';
import { ButtonGrid } from './ButtonGrid';
import { StressPicker } from './StressPicker';
import { TagInput } from './TagInput';

type SetFn = <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;

export function buildFieldRenderCtx(data: OnboardingData): FieldRenderCtx {
  const bmi = data.height_cm > 0 ? data.weight_kg / ((data.height_cm / 100) ** 2) : 0;
  return {
    age: data.age,
    gender: data.gender,
    weight_kg: data.weight_kg,
    height_cm: data.height_cm,
    bmi,
    country: data.country,
    activityModalities: data.activity_modalities,
    goalDetails: data.goal_details,
  };
}

function setGoalDetail<M extends keyof GoalDetails>(
  set: SetFn,
  goalDetails: GoalDetails,
  modality: M,
  partial: Partial<NonNullable<GoalDetails[M]>>
) {
  set('goal_details', {
    ...goalDetails,
    [modality]: { ...(goalDetails[modality] ?? {}), ...partial } as GoalDetails[M],
  });
}

export function StepGoalModality({ modality, data, set }: { modality: GoalModality; data: OnboardingData; set: SetFn }) {
  const definition = MODALITY_REGISTRY[modality];
  const ctx = buildFieldRenderCtx(data);
  const details = (data.goal_details[modality] ?? {}) as Record<string, unknown>;
  const header = typeof definition.stepHeader === 'function' ? definition.stepHeader(ctx) : definition.stepHeader;

  function update(field: ModalityFieldDef<unknown>, value: string | string[] | number | boolean) {
    setGoalDetail(set, data.goal_details, modality, { [field.key]: value } as Partial<NonNullable<GoalDetails[typeof modality]>>);
  }

  return (
    <div className="space-y-5">
      {definition.disclaimer && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-300/80 leading-relaxed">
            <strong className="text-amber-300">Medical disclaimer:</strong> {definition.disclaimer}
          </p>
        </div>
      )}
      <StepHeader title={header.title} subtitle={header.subtitle} />
      {definition.uiFields.map(field => {
        if (field.visibleIf && !field.visibleIf(ctx)) return null;

        const options = typeof field.options === 'function' ? field.options(ctx) : field.options ?? [];
        const helperText = typeof field.helperText === 'function' ? field.helperText(ctx) : field.helperText;
        const cols = typeof field.cols === 'function' ? field.cols(ctx) : field.cols;
        const rawValue = details[field.key];

        if (field.kind === 'info') {
          return (
            <p key={field.key} className="text-xs text-gray-500 bg-gray-800/50 rounded-xl px-4 py-3">
              {field.label}
            </p>
          );
        }

        if (field.kind === 'tags') {
          return (
            <TagInput
              key={field.key}
              label={field.label}
              optional={field.optional}
              hint={helperText}
              placeholder={field.placeholder}
              tags={(rawValue as string[]) ?? []}
              onChange={v => update(field, v)}
            />
          );
        }

        return (
          <div key={field.key}>
            <FieldLabel optional={field.optional}>
              {field.label}{field.labelNote && ' '}
              {field.labelNote && <span className="text-xs text-gray-500 font-normal">{field.labelNote}</span>}
            </FieldLabel>
            {field.kind === 'radio' && (
              <RadioCards
                value={(rawValue as string) ?? ''}
                onChange={v => update(field, v)}
                options={options}
              />
            )}
            {field.kind === 'multiselect' && (
              <MultiSelectChips
                selected={(rawValue as string[]) ?? []}
                onChange={v => update(field, v)}
                max={field.max}
                options={options.map(o => ({ id: o.value, label: o.label }))}
              />
            )}
            {field.kind === 'buttongrid' && (
              <ButtonGrid
                value={
                  field.valueType === 'boolean'
                    ? (rawValue === true ? 'yes' : rawValue === false ? 'no' : '')
                    : (rawValue as string | number) ?? (field.valueType === 'number' ? 0 : '')
                }
                onChange={v => update(field, field.valueType === 'number' ? Number(v) : field.valueType === 'boolean' ? v === 'yes' : v)}
                options={options}
                cols={cols}
              />
            )}
            {field.kind === 'stresspicker' && (
              <StressPicker
                value={(rawValue as number) ?? 0}
                onChange={v => update(field, v)}
              />
            )}
            {helperText && <p className="text-xs text-amber-400/70 mt-1">{helperText}</p>}
          </div>
        );
      })}
    </div>
  );
}
