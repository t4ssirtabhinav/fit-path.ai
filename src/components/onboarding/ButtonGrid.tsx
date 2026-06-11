export function ButtonGrid({
  options, value, onChange, cols = 2,
}: {
  options: { value: string; label: string }[];
  value: string | number;
  onChange: (v: string) => void;
  cols?: number;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-all duration-200 text-left ${
            String(value) === opt.value
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
              : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
