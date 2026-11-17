import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import type { ToastItem, ToastType } from '../context/ToastContext';

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const toastTypeConfig: Record<
  ToastType,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    badgeBorder: string;
    barColor: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-[#234aff]/10 dark:bg-[#234aff]/20',
    iconColor: 'text-[#234aff] dark:text-[#5271ff]',
    badgeBorder: 'border-[#234aff]/20',
    barColor: 'bg-[#234aff]',
  },
  error: {
    icon: AlertCircle,
    iconBg: 'bg-rose-50 dark:bg-rose-950/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
    badgeBorder: 'border-rose-200 dark:border-rose-800/40',
    barColor: 'bg-rose-500',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    badgeBorder: 'border-amber-200 dark:border-amber-800/40',
    barColor: 'bg-amber-500',
  },
  info: {
    icon: Info,
    iconBg: 'bg-stone-100 dark:bg-slate-800',
    iconColor: 'text-stone-700 dark:text-slate-300',
    badgeBorder: 'border-stone-200 dark:border-slate-700',
    barColor: 'bg-stone-400 dark:bg-slate-500',
  },
};

export const ToastCard: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(toast.duration ?? 4000);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);

  const config = toastTypeConfig[toast.type];
  const Icon = config.icon;

  const triggerDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  };

  useEffect(() => {
    if ((toast.duration ?? 4000) <= 0) return;

    if (!isPaused) {
      startTimeRef.current = Date.now();
      timerRef.current = window.setTimeout(() => {
        triggerDismiss();
      }, remainingTimeRef.current);
    } else {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        const elapsed = Date.now() - startTimeRef.current;
        remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
      }
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [isPaused, toast.duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`group pointer-events-auto relative flex w-80 sm:w-88 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-[#e5e3dc] dark:border-slate-800 bg-white/95 dark:bg-[#131926]/95 backdrop-blur-md p-4 shadow-xl shadow-stone-900/5 dark:shadow-black/20 transition-all duration-200 ease-out ${
        isLeaving
          ? 'opacity-0 translate-y-2 scale-95'
          : 'opacity-100 translate-y-0 scale-100 animate-in fade-in slide-in-from-bottom-2'
      }`}
    >
      {/* Icon Badge */}
      <div
        className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border ${config.badgeBorder} ${config.iconBg}`}
      >
        <Icon className={`w-4 h-4 ${config.iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-xs font-semibold tracking-tight text-[#12141d] dark:text-slate-100 font-display leading-snug">
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-[12px] leading-relaxed text-[#58554d] dark:text-slate-400 mt-1 whitespace-normal break-words font-sans">
            {toast.message}
          </p>
        )}
        {toast.action && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                triggerDismiss();
              }}
              className="text-xs font-medium text-[#234aff] hover:underline"
            >
              {toast.action.label}
            </button>
          </div>
        )}
      </div>

      {/* Dismiss Button */}
      <button
        type="button"
        onClick={triggerDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800/60 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Visual Accent Edge */}
      <div
        className={`absolute bottom-0 left-3 right-3 h-[2px] rounded-full ${config.barColor} opacity-70`}
      />
    </div>
  );
};

export const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-full px-4 sm:px-0"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} toast={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
