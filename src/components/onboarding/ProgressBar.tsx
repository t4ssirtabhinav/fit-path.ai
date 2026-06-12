function getStageLabel(stepId: string): string {
  if (stepId === 'about_you')                                   return 'About You';
  if (stepId === 'intention')                                   return 'Your Path';
  if (stepId === 'goal_selection')                              return 'Goals';
  if (stepId.startsWith('goal_'))                               return 'Details';
  if (stepId === 'lifestyle')                                   return 'Lifestyle';
  if (stepId === 'plan_confirm')                                return 'All Set';
  if (stepId === 'track_setup')                                 return 'Setup';
  if (stepId === 'track_confirm')                               return 'All Set';
  return '';
}

export function ProgressBar({ stepIndex, totalSteps, stepId }: { stepIndex: number; totalSteps: number; stepId: string }) {
  const pct = totalSteps > 1 ? Math.round((stepIndex / (totalSteps - 1)) * 100) : 100;
  return (
    <div className="w-full mb-7">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium text-emerald-400">{getStageLabel(stepId)}</span>
        <span className="text-xs text-gray-500">{pct}% complete</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
