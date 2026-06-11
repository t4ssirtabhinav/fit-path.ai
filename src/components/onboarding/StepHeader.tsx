export function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
      <p className="text-sm text-gray-400 leading-relaxed">{subtitle}</p>
    </div>
  );
}
