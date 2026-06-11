export function StressPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const opts = [
    { v: 1, label: 'Very calm', emoji: '😌' },
    { v: 2, label: 'Calm',      emoji: '🙂' },
    { v: 3, label: 'Moderate',  emoji: '😐' },
    { v: 4, label: 'Stressed',  emoji: '😟' },
    { v: 5, label: 'Very stressed', emoji: '😤' },
  ];
  return (
    <div className="flex gap-2">
      {opts.map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all duration-200 ${
            value === o.v
              ? 'bg-emerald-500/20 border-emerald-500'
              : 'bg-gray-800 border-gray-700 hover:border-gray-600'
          }`}
        >
          <span className="text-lg">{o.emoji}</span>
          <span className="text-xs text-gray-400 hidden sm:block">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
