import { useState, useRef, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { FieldLabel } from './FieldLabel';

export function TagInput({
  label, tags, onChange, placeholder, hint, optional,
}: {
  label: string;
  tags: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  hint?: string;
  optional?: boolean;
}) {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const trimmed = raw.trim().slice(0, 60);
    if (trimmed && !tags.includes(trimmed) && tags.length < 20)
      onChange([...tags, trimmed]);
    setVal('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(val); }
    else if (e.key === 'Backspace' && val === '' && tags.length > 0) onChange(tags.slice(0, -1));
  }

  return (
    <div>
      <FieldLabel optional={optional}>{label}</FieldLabel>
      <div
        className="min-h-[42px] bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 flex flex-wrap gap-1.5 items-center focus-within:border-emerald-500 transition-colors cursor-text"
        onClick={() => ref.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-xs font-medium px-2 py-0.5 rounded-lg">
            {tag}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(tags.filter((_, idx) => idx !== i)); }}
              className="text-emerald-400 hover:text-white ml-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={ref}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (val.trim()) addTag(val); }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none min-w-[100px]"
        />
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
