import React, { useMemo, useState } from 'react';
import type { ApplicationStatus, StatsSummary } from '../types';

export const FUNNEL_STAGE_BARS: {
  key: ApplicationStatus;
  label: string;
  barClass: string;
  textClass: string;
  dotClass: string;
}[] = [
  { key: 'applied', label: 'Applied', barClass: 'bg-[#3c3f4a]', textClass: 'text-[#3c3f4a]', dotClass: 'bg-[#3c3f4a]' },
  { key: 'interviewing', label: 'Interviewing', barClass: 'bg-[#234aff]', textClass: 'text-[#234aff]', dotClass: 'bg-[#234aff]' },
  { key: 'offer', label: 'Offer', barClass: 'bg-[#107e3e]', textClass: 'text-[#107e3e]', dotClass: 'bg-[#107e3e]' },
  { key: 'rejected', label: 'Rejected', barClass: 'bg-[#c53030]', textClass: 'text-[#c53030]', dotClass: 'bg-[#c53030]' },
  { key: 'ghosted', label: 'Ghosted (10d+)', barClass: 'bg-[#b46500]', textClass: 'text-[#b46500]', dotClass: 'bg-[#b46500]' },
];

interface ApplicationsByStageCardProps {
  funnel: StatsSummary['funnel'];
  onSelectStage: (status: ApplicationStatus) => void;
}

export const ApplicationsByStageCard: React.FC<ApplicationsByStageCardProps> = ({
  funnel,
  onSelectStage,
}) => (
  <section className="studio-card rounded-2xl p-6 space-y-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold tracking-tight text-[#12141d] font-display">Applications by Stage</h3>
        <p className="text-xs text-[#58554d] mt-0.5">
          Select any stage to filter those applications.
        </p>
      </div>
      <span className="font-mono-tabular text-xs text-[#58554d] px-2.5 py-1 rounded-full bg-[#eeece6] border border-[#e5e3dc] font-semibold">
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
            className="w-full text-left group rounded-xl p-2.5 -mx-2 hover:bg-[#f6f5f2] transition-all border border-transparent hover:border-[#e5e3dc]"
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={`font-bold flex items-center gap-2 ${stage.textClass}`}>
                <span className={`w-2 h-2 rounded-full ${stage.dotClass}`} />
                {stage.label}
              </span>
              <span className="font-mono-tabular text-[#58554d]">
                <strong className="text-[#12141d] font-bold">{count}</strong>{' '}
                <span className="text-[#8e8a7f]">({pct}%)</span>
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-[#eeece6] overflow-hidden">
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
    <section className="studio-card rounded-2xl p-6 flex flex-col justify-between space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-[#12141d] font-display">
            {paceMode === 'daily'
              ? `Applications per Day (${paceSeries.length}d)`
              : 'Applications per Week (12w)'}
          </h3>
          <div className="mt-0.5 h-5 flex items-center text-xs font-mono-tabular text-[#58554d] whitespace-nowrap overflow-hidden">
            {activeHoveredPoint ? (
              <span className="text-[#234aff] font-bold truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#234aff]" />
                {activeHoveredPoint.tooltipPrefix} {activeHoveredPoint.label}:{' '}
                <strong className="text-[#12141d]">{activeHoveredPoint.count}</strong> applied
              </span>
            ) : paceMode === 'daily' ? (
              <div className="flex items-center gap-2 truncate">
                <span>
                  Today: <strong className="text-[#12141d]">{dailyPaceSummary.today_count}</strong>
                </span>
                <span aria-hidden="true" className="text-[#e5e3dc]">
                  ·
                </span>
                <span>
                  Avg: <strong className="text-[#12141d]">{dailyPaceSummary.avg_per_day}/d</strong>
                </span>
                <span aria-hidden="true" className="text-[#e5e3dc]">
                  ·
                </span>
                <span>
                  Peak: <strong className="text-[#12141d]">{dailyPaceSummary.peak_count}</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <span>
                  This wk: <strong className="text-[#12141d]">{weeklyPaceSummary.this_week_count}</strong>
                </span>
                <span aria-hidden="true" className="text-[#e5e3dc]">
                  ·
                </span>
                <span>
                  Avg: <strong className="text-[#12141d]">{weeklyPaceSummary.avg_per_week}/wk</strong>
                </span>
                <span aria-hidden="true" className="text-[#e5e3dc]">
                  ·
                </span>
                <span>
                  Peak: <strong className="text-[#12141d]">{weeklyPaceSummary.peak_count}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-[#eeece6] rounded-xl border border-[#e5e3dc] shrink-0">
          <button
            type="button"
            onClick={() => {
              onChangePaceMode('daily');
              setHoveredKey(null);
            }}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              paceMode === 'daily'
                ? 'bg-white text-[#12141d] shadow-xs border border-[#e5e3dc]'
                : 'text-[#58554d] hover:text-[#12141d]'
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
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              paceMode === 'weekly'
                ? 'bg-white text-[#12141d] shadow-xs border border-[#e5e3dc]'
                : 'text-[#58554d] hover:text-[#12141d]'
            }`}
          >
            Weekly
          </button>
        </div>
      </div>

      <div className="pt-2">
        <div className="h-44 flex items-end gap-1.5 border-b border-[#e5e3dc] pb-1">
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
                    pt.count > 0 ? 'text-[#12141d] font-bold' : 'text-[#8e8a7f]/50'
                  }`}
                >
                  {pt.count}
                </span>
                <div
                  className={`w-full rounded-t-md transition-all duration-200 ${
                    pt.count === 0
                      ? 'bg-[#eeece6]'
                      : isCurrent
                      ? 'bg-[#234aff] group-hover:bg-[#1938d8]'
                      : 'bg-[#12141d] group-hover:bg-[#234aff]'
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
                className="flex-1 text-center font-mono-tabular text-[10px] text-[#8e8a7f] truncate font-medium"
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
