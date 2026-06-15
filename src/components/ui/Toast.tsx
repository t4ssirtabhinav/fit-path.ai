import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const ICONS = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
  error: <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />,
  info: <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />,
};

const BORDERS = {
  success: 'border-emerald-500/30',
  error: 'border-red-500/30',
  info: 'border-sky-500/30',
};

export function Toast() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto z-50 flex flex-col gap-2 items-stretch md:items-end pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-2 bg-gray-800/95 border ${BORDERS[toast.type]} rounded-xl px-4 py-3 shadow-lg backdrop-blur-sm md:max-w-sm animate-[fade-in_0.2s_ease-out]`}
        >
          {ICONS[toast.type]}
          <p className="text-sm text-gray-100 flex-1">{toast.message}</p>
          <button onClick={() => dismissToast(toast.id)} className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
