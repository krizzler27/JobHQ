import React, { useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  History,
  Play,
  RefreshCw,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { WorkerConfig } from '../types';
import { useToast } from '../context/ToastContext';

interface BackgroundJobsSectionProps {
  workers: WorkerConfig[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onUpdateWorker: (
    name: string,
    payload: { interval_minutes?: number; is_enabled?: boolean; threshold_days?: number }
  ) => Promise<void>;
  onRunWorker: (name: string) => Promise<void>;
}

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'safety & recovery':
      return Database;
    case 'data hygiene':
      return Archive;
    case 'pipeline hygiene':
      return Sparkles;
    case 'synchronization':
      return RefreshCw;
    default:
      return Cpu;
  }
};

const formatTimeAgo = (isoDate: string | null): string => {
  if (!isoDate) return 'Never run';
  const now = new Date();
  const past = new Date(isoDate);
  const diffMs = now.getTime() - past.getTime();
  if (isNaN(diffMs)) return 'Invalid date';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
};

export const BackgroundJobsSection: React.FC<BackgroundJobsSectionProps> = ({
  workers,
  isLoading,
  onRefresh,
  onUpdateWorker,
  onRunWorker,
}) => {
  const [runningMap, setRunningMap] = useState<Record<string, boolean>>({});
  const [justCompletedMap, setJustCompletedMap] = useState<Record<string, boolean>>({});
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const handleToggle = async (worker: WorkerConfig) => {
    const nextState = !worker.is_enabled;
    setSavingMap((prev) => ({ ...prev, [worker.name]: true }));
    try {
      await onUpdateWorker(worker.name, { is_enabled: nextState });
      toast.success(
        nextState ? 'Worker Activated' : 'Worker Paused',
        `${worker.title} will ${nextState ? 'run automatically on schedule' : 'no longer run in the background'}.`
      );
    } catch (err) {
      toast.error('Failed to update worker', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingMap((prev) => ({ ...prev, [worker.name]: false }));
    }
  };

  const handleIntervalChange = async (worker: WorkerConfig, minutes: number) => {
    setSavingMap((prev) => ({ ...prev, [worker.name]: true }));
    try {
      await onUpdateWorker(worker.name, { interval_minutes: minutes });
      toast.success('Schedule Updated', `${worker.title} interval set.`);
    } catch (err) {
      toast.error('Failed to update interval', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingMap((prev) => ({ ...prev, [worker.name]: false }));
    }
  };

  const handleThresholdChange = async (worker: WorkerConfig, days: number) => {
    setSavingMap((prev) => ({ ...prev, [worker.name]: true }));
    try {
      await onUpdateWorker(worker.name, { threshold_days: days });
      toast.success('Threshold Updated', `${worker.title} retention rule set to ${days} days.`);
    } catch (err) {
      toast.error('Failed to update threshold', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingMap((prev) => ({ ...prev, [worker.name]: false }));
    }
  };

  const handleRun = async (worker: WorkerConfig) => {
    const isAsync = worker.name === 'email_job_sync';
    setRunningMap((prev) => ({ ...prev, [worker.name]: true }));
    setJustCompletedMap((prev) => ({ ...prev, [worker.name]: false }));
    try {
      await onRunWorker(worker.name);
      setJustCompletedMap((prev) => ({ ...prev, [worker.name]: true }));
      if (isAsync) {
        toast.info(
          'Sync Started in Background',
          'Scanning your inbox in the background. Check the header or Overview for progress.'
        );
      } else {
        toast.success('Run Complete', `${worker.title} executed successfully.`);
      }
      setTimeout(() => {
        setJustCompletedMap((prev) => ({ ...prev, [worker.name]: false }));
      }, 3500);
    } catch (err) {
      toast.error('Execution Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRunningMap((prev) => ({ ...prev, [worker.name]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Overview Card */}
      <div className="studio-card rounded-2xl border border-[#e5e3dc] dark:border-slate-800 p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-[#eeece6] dark:bg-slate-800 text-stone-700 dark:text-slate-200 shrink-0">
            <Cpu className="w-5 h-5 text-[#234aff]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-slate-100">
              Desktop Background Workers
            </h2>
            <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5 max-w-xl">
              Workers execute in the background via lightweight interval timers rather than fixed-time wall-clock crons.
              If your device was offline or closed, workers catch up automatically when JobHQ is opened.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-xl whitespace-nowrap transition-colors shadow-2xs disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Checking...' : 'Refresh Status'}
        </button>
      </div>

      {/* Workers Grid */}
      <div className="space-y-4">
        {workers.map((worker) => {
          const CategoryIcon = getCategoryIcon(worker.category);
          const isRunning = Boolean(runningMap[worker.name]);
          const isJustCompleted = Boolean(justCompletedMap[worker.name]);
          const isSaving = Boolean(savingMap[worker.name]);

          return (
            <div
              key={worker.name}
              className="studio-card rounded-2xl border border-[#e5e3dc] dark:border-slate-800 p-5 space-y-4 transition-all"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-[#f6f5f2] dark:bg-slate-800/80 text-stone-700 dark:text-slate-200 shrink-0 mt-0.5">
                    <CategoryIcon className="w-4 h-4 text-[#234aff]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100">
                        {worker.title}
                      </h3>
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-400 border border-[#e5e3dc] dark:border-slate-700">
                        {worker.category}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-slate-400 mt-1">
                      {worker.description}
                    </p>
                  </div>
                </div>

                {/* Worker Switch */}
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={worker.is_enabled}
                      disabled={isSaving}
                      onChange={() => handleToggle(worker)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-[#234aff]"></div>
                  </label>
                  <span className="text-xs font-medium text-stone-700 dark:text-slate-300 min-w-14">
                    {worker.is_enabled ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>

              {/* Status and Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#e5e3dc] dark:border-slate-800/80">
                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 dark:text-slate-400">
                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5">
                    {worker.last_status === 'success' && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Success
                      </span>
                    )}
                    {worker.last_status === 'failed' && (
                      <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        Failed
                      </span>
                    )}
                    {worker.last_status === 'never_run' && (
                      <span className="inline-flex items-center gap-1 text-stone-500 dark:text-slate-400">
                        <History className="w-3.5 h-3.5" />
                        Never run
                      </span>
                    )}
                  </div>

                  <span>•</span>

                  {/* Last Run Time */}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    Last run: <strong className="font-mono-tabular font-medium text-stone-800 dark:text-slate-200">{formatTimeAgo(worker.last_run_at)}</strong>
                  </span>

                  {worker.last_duration_seconds !== null && (
                    <>
                      <span>•</span>
                      <span className="font-mono-tabular text-stone-500">
                        {worker.last_duration_seconds.toFixed(2)}s
                      </span>
                    </>
                  )}

                  {worker.last_error && (
                    <span className="text-rose-600 dark:text-rose-400 truncate max-w-xs" title={worker.last_error}>
                      ({worker.last_error})
                    </span>
                  )}
                </div>

                {/* Interval / Threshold Selector and Manual Run */}
                <div className="flex flex-wrap items-center gap-3">
                  {worker.threshold_options && worker.threshold_options.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-stone-500 dark:text-slate-400">
                        {worker.threshold_label || 'Threshold'}:
                      </span>
                      <select
                        value={worker.threshold_days ?? worker.threshold_options[0].value}
                        disabled={isSaving}
                        onChange={(e) => handleThresholdChange(worker, parseInt(e.target.value, 10))}
                        className="rounded-xl border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] text-xs font-semibold text-stone-800 dark:text-slate-200 px-2.5 py-1.5 focus:border-[#234aff] focus:ring-1 focus:ring-[#234aff] focus:outline-none disabled:opacity-60"
                      >
                        {worker.threshold_options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-stone-500 dark:text-slate-400">Interval:</span>
                    <select
                      value={worker.interval_minutes}
                      disabled={isSaving}
                      onChange={(e) => handleIntervalChange(worker, parseInt(e.target.value, 10))}
                      className="rounded-xl border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] text-xs font-semibold text-stone-800 dark:text-slate-200 px-2.5 py-1.5 focus:border-[#234aff] focus:ring-1 focus:ring-[#234aff] focus:outline-none disabled:opacity-60"
                    >
                      {worker.interval_options.map((opt) => (
                        <option key={opt.minutes} value={opt.minutes}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRun(worker)}
                    disabled={isRunning || isJustCompleted}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all shadow-2xs cursor-pointer ${
                      isJustCompleted
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : isRunning
                        ? 'bg-[#234aff]/10 text-[#234aff] border border-[#234aff]/30 cursor-wait'
                        : 'text-stone-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-800'
                    } disabled:opacity-80`}
                  >
                    {isRunning ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#234aff]" />
                        Running...
                      </>
                    ) : isJustCompleted ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        {worker.name === 'email_job_sync' ? 'Triggered' : 'Completed'}
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Run Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
