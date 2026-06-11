export function MultiSelectChips({
  options, selected, onChange, max,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt.id);
        const capped = !active && max !== undefined && selected.length >= max;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={capped}
            onClick={() => onChange(active ? selected.filter(s => s !== opt.id) : [...selected, opt.id])}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
              active  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
              : capped ? 'bg-gray-800/40 border-gray-800 text-gray-600 cursor-not-allowed'
              :          'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
