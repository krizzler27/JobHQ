import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface LookbackOption {
  value: number;
  label: string;
}

export const DEFAULT_LOOKBACK_OPTIONS: LookbackOption[] = [
  { value: 1, label: 'Last 1 day' },
  { value: 3, label: 'Last 3 days' },
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
];

interface LookbackDropdownProps {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  options?: LookbackOption[];
  className?: string;
  buttonClassName?: string;
}

export const LookbackDropdown: React.FC<LookbackDropdownProps> = ({
  value,
  disabled = false,
  onChange,
  options = DEFAULT_LOOKBACK_OPTIONS,
  className = '',
  buttonClassName = '',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Email sync lookback window"
        className={`inline-flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#e5e3dc] dark:border-slate-700/80 bg-white dark:bg-[#182030] text-stone-700 dark:text-slate-200 hover:bg-[#f6f5f2] dark:hover:bg-slate-800 shadow-2xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-400 dark:text-slate-500 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl border border-[#e5e3dc] dark:border-slate-800 bg-white dark:bg-[#182030] p-1 shadow-lg z-50">
          <div role="listbox" className="space-y-0.5">
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#234aff]/10 text-[#234aff] dark:text-blue-400 font-semibold'
                      : 'text-stone-700 dark:text-slate-300 hover:bg-[#f6f5f2] dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{opt.label}</span>
                  {active && <Check className="w-3.5 h-3.5 text-[#234aff] dark:text-blue-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
