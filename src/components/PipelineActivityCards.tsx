import React, { useMemo, useState } from 'react';
import type { ApplicationStatus, StatsSummary } from '../types';

export const FUNNEL_STAGE_BARS: {
  key: ApplicationStatus;
  label: string;
  barClass: string;
  textClass: string;
}[] = [
  { key: 'applied', label: 'Applied', barClass: 'bg-slate-500 dark:bg-slate-400', textClass: 'text-slate-700 dark:text-slate-300' },
  { key: 'interviewing', label: 'Interviewing', barClass: 'bg-blue-600 dark:bg-blue-500', textClass: 'text-blue-700 dark:text-blue-400' },
  { key: 'offer', label: 'Offer', barClass: 'bg-emerald-600 dark:bg-emerald-500', textClass: 'text-emerald-700 dark:text-emerald-400' },
  { key: 'rejected', label: 'Rejected', barClass: 'bg-rose-500 dark:bg-rose-400', textClass: 'text-rose-700 dark:text-rose-400' },
  { key: 'ghosted', label: 'Ghosted (10d+)', barClass: 'bg-amber-500 dark:bg-amber-400', textClass: 'text-amber-700 dark:text-amber-400' },
];

interface ApplicationsByStageCardProps {
  funnel: StatsSummary['funnel'];
  onSelectStage: (status: ApplicationStatus) => void;
}

export const ApplicationsByStageCard: React.FC<ApplicationsByStageCardProps> = ({
  funnel,
  onSelectStage,
}) => (
  <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] p-5 space-y-4 shadow-2xs">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">Applications by Stage</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Click any stage to filter those applications.
        </p>
      </div>
      <span className="font-mono-tabular text-xs text-slate-400 dark:text-slate-500">
        {funnel.total_applications} total
      </span>
    </div>

    <div className="space-y-2.5">
      {FUNNEL_STAGE_BARS.map((stage) => {
        const count = funnel.stage_counts[stage.key] ?? 0;
        const pct =
          funnel.total_applications > 0
            ? Math.round((count / funnel.total_applications) * 1000) / 10
            : 0;
        const barWidth =
          funnel.total_applications > 0 && count > 0 ? Math.max(4, pct) : 0;
        return (
          <button
            key={stage.key}
            type="button"
            onClick={() => onSelectStage(stage.key)}
            className="w-full text-left group rounded-lg p-2 -mx-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={`font-semibold ${stage.textClass}`}>
                {stage.label}
              </span>
              <span className="font-mono-tabular text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{count}</span>{' '}
                <span className="text-slate-400 dark:text-slate-500">({pct}%)</span>
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${stage.barClass}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  </section>
);

interface ApplicationPaceCardProps {
  dailyPace: StatsSummary['daily_pace'];
  dailyPaceSummary: StatsSummary['daily_pace_summary'];
  weeklyPace: StatsSummary['weekly_pace'];
  weeklyPaceSummary: StatsSummary['pace_summary'];
  paceMode: 'daily' | 'weekly';
  onChangePaceMode: (mode: 'daily' | 'weekly') => void;
}

export const ApplicationPaceCard: React.FC<ApplicationPaceCardProps> = ({
  dailyPace,
  dailyPaceSummary,
  weeklyPace,
  weeklyPaceSummary,
  paceMode,
  onChangePaceMode,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const paceSeries = useMemo(() => {
    if (paceMode === 'daily') {
      return (dailyPace || []).map((d) => ({
        key: d.date,
        label: d.label,
        axisLabel: d.short_label,
        count: d.count,
        tooltipPrefix: 'Date',
      }));
    }
    return (weeklyPace || []).map((w) => ({
      key: w.week_start,
      label: w.label,
      axisLabel: w.label,
      count: w.count,
      tooltipPrefix: 'Week of',
    }));
  }, [dailyPace, weeklyPace, paceMode]);

  const maxPaceCount = useMemo(() => {
    if (paceSeries.length === 0) return 1;
    return Math.max(1, ...paceSeries.map((p) => p.count));
  }, [paceSeries]);

  const activeHoveredPoint = useMemo(() => {
    if (!hoveredKey) return null;
    return paceSeries.find((p) => p.key === hoveredKey) || null;
  }, [paceSeries, hoveredKey]);

  return (
    <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] p-5 flex flex-col justify-between space-y-4 shadow-2xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {paceMode === 'daily'
              ? `Applications per Day (${paceSeries.length}d)`
              : 'Applications per Week (12w)'}
          </h3>
          <div className="mt-0.5 h-5 flex items-center text-xs font-mono-tabular text-slate-500 dark:text-slate-400 whitespace-nowrap overflow-hidden">
            {activeHoveredPoint ? (
              <span className="text-blue-600 dark:text-blue-400 font-semibold truncate">
                {activeHoveredPoint.tooltipPrefix} {activeHoveredPoint.label}:{' '}
                <strong className="text-slate-900 dark:text-slate-100">{activeHoveredPoint.count}</strong> applied
              </span>
            ) : paceMode === 'daily' ? (
              <div className="flex items-center gap-2 truncate">
                <span>
                  Today: <strong className="text-slate-900 dark:text-slate-100">{dailyPaceSummary.today_count}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span>
                  Avg: <strong className="text-slate-900 dark:text-slate-100">{dailyPaceSummary.avg_per_day}/d</strong>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span>
                  Peak: <strong className="text-slate-900 dark:text-slate-100">{dailyPaceSummary.peak_count}</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <span>
                  This wk: <strong className="text-slate-900 dark:text-slate-100">{weeklyPaceSummary.this_week_count}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span>
                  Avg: <strong className="text-slate-900 dark:text-slate-100">{weeklyPaceSummary.avg_per_week}/wk</strong>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span>
                  Peak: <strong className="text-slate-900 dark:text-slate-100">{weeklyPaceSummary.peak_count}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-900/80 rounded-lg border border-slate-200/60 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => {
              onChangePaceMode('daily');
              setHoveredKey(null);
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              paceMode === 'daily'
                ? 'bg-white dark:bg-[#1c2436] text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => {
              onChangePaceMode('weekly');
              setHoveredKey(null);
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              paceMode === 'weekly'
                ? 'bg-white dark:bg-[#1c2436] text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Weekly
          </button>
        </div>
      </div>

      <div className="pt-2">
        <div className="h-44 flex items-end gap-1.5 border-b border-slate-100 dark:border-slate-800/80 pb-1">
          {paceSeries.map((pt, idx) => {
            const heightPct =
              pt.count > 0 ? Math.max(8, Math.round((pt.count / maxPaceCount) * 100)) : 3;
            const isCurrent = idx === paceSeries.length - 1;
            return (
              <div
                key={pt.key}
                onMouseEnter={() => setHoveredKey(pt.key)}
                onMouseLeave={() => setHoveredKey(null)}
                title={`${pt.tooltipPrefix} ${pt.key}: ${pt.count} applications`}
                className="flex-1 h-full flex flex-col items-center justify-end group cursor-pointer"
              >
                <span
                  className={`font-mono-tabular text-[10px] mb-1 transition-colors ${
                    pt.count > 0 ? 'text-slate-700 dark:text-slate-300 font-semibold' : 'text-slate-300 dark:text-slate-600'
                  }`}
                >
                  {pt.count}
                </span>
                <div
                  className={`w-full rounded-t-sm transition-all duration-200 ${
                    pt.count === 0
                      ? 'bg-slate-100 dark:bg-slate-800/50'
                      : isCurrent
                      ? 'bg-blue-600 dark:bg-blue-500 group-hover:bg-blue-700'
                      : 'bg-slate-600 dark:bg-slate-500 group-hover:bg-blue-500'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 pt-2">
          {paceSeries.map((pt, idx) => {
            const showLabel =
              paceSeries.length <= 8 ||
              idx % (paceSeries.length > 16 ? 5 : 2) === 0 ||
              idx === paceSeries.length - 1;
            return (
              <div
                key={pt.key}
                className="flex-1 text-center font-mono-tabular text-[10px] text-slate-400 dark:text-slate-500 truncate"
              >
                {showLabel ? pt.axisLabel : ''}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
