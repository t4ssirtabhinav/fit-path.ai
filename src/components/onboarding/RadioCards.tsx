export function RadioCards({
  options, value, onChange,
}: {
  options: { value: string; label: string; description?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition-all duration-200 text-left ${
            value === opt.value
              ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-300'
              : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
          }`}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors ${
            value === opt.value ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'
          }`} />
          <div>
            <p className="text-sm font-medium leading-snug">{opt.label}</p>
            {opt.description && <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}
