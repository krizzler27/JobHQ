import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api';
import type { ApplicationStatus, PlatformStat, StatsSummary } from '../types';
import { PaginationBar } from './PaginationBar';
import { ApplicationPaceCard, ApplicationsByStageCard } from './PipelineActivityCards';

interface StatsViewProps {
  refreshTrigger?: number;
  imapConnected: boolean;
  onAddApplication: () => void;
  onSyncInbox: () => void;
  onJumpToApplications: (opts: { status?: ApplicationStatus; search?: string }) => void;
}

type RangeOption = '3' | '7' | '15' | '30' | '90' | 'all';
type PaceMode = 'daily' | 'weekly';
type PlatformSortField = 'total' | 'interview_rate_pct' | 'offers' | 'ghosted' | 'avg_response_days';

export const StatsView: React.FC<StatsViewProps> = ({
  refreshTrigger = 0,
  imapConnected,
  onAddApplication,
  onSyncInbox,
  onJumpToApplications,
}) => {
  const [range, setRange] = useState<RangeOption>('all');
  const [paceMode, setPaceMode] = useState<PaceMode>('weekly');
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState<PlatformSortField>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [platformPage, setPlatformPage] = useState(1);
  const [platformPageSize, setPlatformPageSize] = useState(10);

  const handleRangeChange = (next: RangeOption) => {
    setRange(next);
    setPlatformPage(1);
    setPaceMode(next === '3' || next === '7' || next === '15' ? 'daily' : 'weekly');
  };

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getStats(range);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats.');
    } finally {
      setLoading(false);
    }
  }, [range, refreshTrigger]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const sortedPlatforms = useMemo(() => {
    if (!stats) return [];
    const list = [...stats.platforms];
    const mult = sortDir === 'asc' ? 1 : -1;
    list.sort((a: PlatformStat, b: PlatformStat) => {
      if (sortField === 'avg_response_days') {
        const av = a.avg_response_days ?? Number.POSITIVE_INFINITY;
        const bv = b.avg_response_days ?? Number.POSITIVE_INFINITY;
        return (av - bv) * mult;
      }
      const av = Number(a[sortField] ?? 0);
      const bv = Number(b[sortField] ?? 0);
      if (av !== bv) return (av - bv) * mult;
      return b.total - a.total;
    });
    return list;
  }, [stats, sortField, sortDir]);

  const totalPlatformPages = Math.max(1, Math.ceil(sortedPlatforms.length / platformPageSize));
  useEffect(() => {
    if (platformPage > totalPlatformPages) {
      setPlatformPage(1);
    }
  }, [platformPage, totalPlatformPages]);

  const pagedPlatforms = useMemo(() => {
    const start = (platformPage - 1) * platformPageSize;
    return sortedPlatforms.slice(start, start + platformPageSize);
  }, [sortedPlatforms, platformPage, platformPageSize]);

  const toggleSort = (field: PlatformSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir(field === 'avg_response_days' ? 'asc' : 'desc');
    }
    setPlatformPage(1);
  };

  const renderSortIcon = (field: PlatformSortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-600" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
            Job Search Stats
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Application stages, reply rate, daily and weekly activity, job alert outcomes, and job board results.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-0.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-lg border border-slate-200/60 dark:border-slate-800 text-xs font-semibold">
          {(
            [
              { key: '3', label: '3 days' },
              { key: '7', label: '7 days' },
              { key: '15', label: '15 days' },
              { key: '30', label: '30 days' },
              { key: '90', label: '90 days' },
              { key: 'all', label: 'All time' },
            ] as { key: RangeOption; label: string }[]
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleRangeChange(opt.key)}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
                range === opt.key
                  ? 'bg-white dark:bg-[#1c2436] text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !stats ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] animate-pulse"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] animate-pulse" />
            <div className="h-72 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] animate-pulse" />
          </div>
          <div className="h-64 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] animate-pulse" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#131926] p-6 flex items-center justify-between gap-4 shadow-xs">
          <div className="text-xs font-medium text-rose-700 dark:text-rose-400">{error}</div>
          <button
            type="button"
            onClick={loadStats}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shadow-2xs transition-colors"
          >
            Retry
          </button>
        </div>
      ) : !stats || (stats.funnel.total_applications === 0 && stats.alert_stats.total_alerts === 0) ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] p-10 text-center shadow-xs">
          <BarChart3 className="w-7 h-7 text-slate-400 dark:text-slate-500 mx-auto mb-2.5" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            No stats available for this time range yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Add applications or sync your inbox to see reply rates, job board results, and weekly activity.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onAddApplication}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Job
            </button>
            {imapConnected && (
              <button
                type="button"
                onClick={onSyncInbox}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg shadow-2xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sync Inbox
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 border-t-2 border-t-slate-400 dark:border-t-slate-500 bg-white dark:bg-[#131926] px-4 py-3.5 shadow-2xs">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Applications</div>
              <div className="mt-1 font-mono-tabular font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {stats.funnel.total_applications}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                {stats.funnel.active_count} active (&lt; 10d or interviewing)
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 border-t-2 border-t-blue-500 bg-white dark:bg-[#131926] px-4 py-3.5 shadow-2xs">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Reply Rate</div>
              <div className="mt-1 font-mono-tabular font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {stats.funnel.response_rate_pct}%
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                {stats.funnel.responded_count} of {stats.funnel.total_applications} replied
                {stats.funnel.avg_response_days !== null
                  ? ` · avg ${stats.funnel.avg_response_days}d`
                  : ''}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 border-t-2 border-t-indigo-500 bg-white dark:bg-[#131926] px-4 py-3.5 shadow-2xs">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Interview Rate</div>
              <div className="mt-1 font-mono-tabular font-display text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                {stats.funnel.interview_rate_pct}%
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                {stats.funnel.interview_reached_count} reached interview
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 border-t-2 border-t-emerald-500 bg-white dark:bg-[#131926] px-4 py-3.5 shadow-2xs">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Offer Rate</div>
              <div className="mt-1 font-mono-tabular font-display text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {stats.funnel.offer_rate_pct}%
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                {stats.funnel.stage_counts.offer} offers · {stats.funnel.ghosted_rate_pct}% ghosted
              </div>
            </div>
          </div>

          {/* Stages & Activity Pace */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ApplicationsByStageCard
              funnel={stats.funnel}
              onSelectStage={(stage) => onJumpToApplications({ status: stage })}
            />

            <ApplicationPaceCard
              dailyPace={stats.daily_pace}
              dailyPaceSummary={stats.daily_pace_summary}
              weeklyPace={stats.weekly_pace}
              weeklyPaceSummary={stats.pace_summary}
              paceMode={paceMode}
              onChangePaceMode={setPaceMode}
            />
          </div>

          {/* Job Alert Review Stats */}
          <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-850 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Job Alert Review Stats
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  How many synced job alert emails turned into tracked applications.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tabular text-slate-600 dark:text-slate-400">
                <span>
                  Total: <strong className="text-slate-900 dark:text-slate-100">{stats.alert_stats.total_alerts}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span>
                  Suggested: <strong className="text-blue-700 dark:text-blue-400">{stats.alert_stats.suggested}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span>
                  Applied: <strong className="text-emerald-700 dark:text-emerald-400">{stats.alert_stats.applied}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span>
                  Dismissed: <strong className="text-slate-700 dark:text-slate-300">{stats.alert_stats.dismissed}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span>
                  Applied Share: <strong className="text-slate-900 dark:text-slate-100">{stats.alert_stats.conversion_rate_pct}%</strong>
                </span>
              </div>
            </div>

            {stats.alert_stats.total_alerts === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No job alerts received in this time range yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-slate-800/80">
                <div className="p-5 space-y-3">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Match Score Summary</div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Relevant (40%+ match)</span>
                      <span className="font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                        {stats.alert_stats.relevant_count}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Strong Match (70%+ match)</span>
                      <span className="font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
                        {stats.alert_stats.strong_match_count}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Applied vs Reviewed</span>
                      <span className="font-mono-tabular font-semibold text-blue-700 dark:text-blue-400">
                        {stats.alert_stats.triaged_conversion_pct}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-850 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="px-4 py-2.5">Alert Source</th>
                        <th className="px-4 py-2.5 text-right">Alerts</th>
                        <th className="px-4 py-2.5 text-right">Suggested</th>
                        <th className="px-4 py-2.5 text-right">Applied</th>
                        <th className="px-4 py-2.5 text-right">Dismissed</th>
                        <th className="px-4 py-2.5 text-right">Avg Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                      {stats.alert_stats.top_sources.map((src) => (
                        <tr key={src.source_app} className="h-9 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-2 font-semibold text-slate-900 dark:text-slate-100">
                            {src.source_app}
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular text-slate-900 dark:text-slate-100">
                            {src.total}
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular text-blue-700 dark:text-blue-400">
                            {src.suggested}
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular text-emerald-700 dark:text-emerald-400">
                            {src.applied}
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular text-slate-500 dark:text-slate-400">
                            {src.dismissed}
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular text-slate-700 dark:text-slate-300">
                            {src.avg_score}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Results by Job Board & Source (Always Last) */}
          <section className="space-y-3">
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-850 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Results by Job Board &amp; Source
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Compare reply rates, interview rates, and response speed across job boards, company portals, and manual entries.
                  </p>
                </div>
                <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                  {sortedPlatforms.length} source{sortedPlatforms.length === 1 ? '' : 's'}
                </span>
              </div>

              {sortedPlatforms.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No applications recorded in this time range yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-850 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="px-4 py-2.5">Source</th>
                        <th className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort('total')}
                            className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            Total {renderSortIcon('total')}
                          </button>
                        </th>
                        <th className="px-4 py-2.5 text-right">Active</th>
                        <th className="px-4 py-2.5 text-right">Interviewing</th>
                        <th className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort('offers')}
                            className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            Offers {renderSortIcon('offers')}
                          </button>
                        </th>
                        <th className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort('ghosted')}
                            className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            Ghosted {renderSortIcon('ghosted')}
                          </button>
                        </th>
                        <th className="px-4 py-2.5 text-right">Reply %</th>
                        <th className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort('interview_rate_pct')}
                            className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            Interview % {renderSortIcon('interview_rate_pct')}
                          </button>
                        </th>
                        <th className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort('avg_response_days')}
                            className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            Avg Reply {renderSortIcon('avg_response_days')}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                      {pagedPlatforms.map((plat) => (
                        <tr
                          key={plat.platform}
                          onClick={() =>
                            onJumpToApplications({
                              search: plat.platform === 'Unknown' ? '' : plat.platform,
                            })
                          }
                          className="h-10 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-2 font-semibold text-slate-900 dark:text-slate-100">
                            {plat.platform}
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular font-bold text-slate-900 dark:text-slate-100">
                            {plat.total}
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular text-slate-700 dark:text-slate-300">
                            {plat.active}
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular text-indigo-600 dark:text-indigo-400 font-semibold">
                            {plat.interviewing}
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular text-emerald-600 dark:text-emerald-400 font-semibold">
                            {plat.offers}
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular text-amber-600 dark:text-amber-400">
                            {plat.ghosted}
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular text-slate-700 dark:text-slate-300">
                            {plat.response_rate_pct}%
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular font-semibold text-indigo-600 dark:text-indigo-400">
                            {plat.interview_rate_pct}%
                          </td>
                          <td className="px-4 py-2 text-right font-mono-tabular text-slate-500 dark:text-slate-400">
                            {plat.avg_response_days !== null ? `${plat.avg_response_days}d` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <PaginationBar
              totalItems={sortedPlatforms.length}
              page={platformPage}
              pageSize={platformPageSize}
              onPageChange={setPlatformPage}
              onPageSizeChange={setPlatformPageSize}
              pageSizeOptions={[5, 10, 25]}
              itemLabel="sources"
            />
          </section>
        </>
      )}
    </div>
  );
};
