import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Briefcase,
  Calendar,
  Check,
  ExternalLink,
  Layers,
  MoreVertical,
  RefreshCw,
  Search,
  ShieldBan,
  Trash2,
  X,
} from 'lucide-react';
import type { JobAlert, JobAlertStatus } from '../types';
import { PaginationBar } from './PaginationBar';

interface JobAlertsViewProps {
  alerts: JobAlert[];
  sources: string[];
  onUpdateStatus: (id: number, status: JobAlertStatus) => Promise<void>;
  onBulkUpdateStatus: (
    ids: number[],
    action: 'dismiss' | 'apply' | 'restore' | 'delete',
  ) => Promise<void>;
  onDeleteAlert: (id: number) => Promise<void>;
  onMoveWrongAlert: (alert: JobAlert, target: 'application' | 'interview') => void;
  onDismissBelowScore: (minScore?: number) => Promise<void>;
  onRescore: () => Promise<void>;
  onOpenBatchDelete: (filteredIds: number[], hasActiveFilter: boolean) => void;
  onFilterEmail: (alert: JobAlert) => void;
}

type AlertSortField =
  | 'relevance_score'
  | 'received_at'
  | 'job_title'
  | 'company_name'
  | 'source_app';

type AlertGroupBy = 'none' | 'status' | 'source_app' | 'match_tier';

const STATUS_ORDER: Record<JobAlertStatus, number> = {
  suggested: 0,
  applied: 1,
  dismissed: 2,
};

const STATUS_META: Record<JobAlertStatus, { label: string; tone: string }> = {
  suggested: { label: 'Suggested', tone: 'text-[#234aff] dark:text-blue-400' },
  applied: { label: 'Applied', tone: 'text-emerald-700 dark:text-emerald-400' },
  dismissed: { label: 'Dismissed', tone: 'text-stone-500 dark:text-slate-400' },
};

function getMatchTier(score: number): { key: string; label: string; tone: string; order: number } {
  if (score >= 70) {
    return { key: 'strong', label: 'Strong Match (70%+)', tone: 'text-emerald-700 dark:text-emerald-400', order: 0 };
  }
  if (score >= 40) {
    return { key: 'good', label: 'Good Match (40–69%)', tone: 'text-[#234aff] dark:text-blue-400', order: 1 };
  }
  return { key: 'low', label: 'Low Match (<40%)', tone: 'text-stone-500 dark:text-slate-400', order: 2 };
}

export const JobAlertsView: React.FC<JobAlertsViewProps> = ({
  alerts,
  sources,
  onUpdateStatus,
  onBulkUpdateStatus,
  onDeleteAlert,
  onMoveWrongAlert,
  onDismissBelowScore,
  onRescore,
  onOpenBatchDelete,
  onFilterEmail,
}) => {
  const [statusFilter, setStatusFilter] = useState<JobAlertStatus | 'all'>('suggested');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [relevantOnly, setRelevantOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [rescoring, setRescoring] = useState(false);

  const [sortField, setSortField] = useState<AlertSortField>('relevance_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<AlertGroupBy>('none');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actionMenu, setActionMenu] = useState<{
    alert: JobAlert;
    top: number;
    right: number;
    openUp: boolean;
  } | null>(null);

  useEffect(() => {
    if (!actionMenu) return;
    const close = () => setActionMenu(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActionMenu(null);
    };
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [actionMenu]);

  const openActionMenu = (e: React.MouseEvent<HTMLButtonElement>, alert: JobAlert) => {
    e.stopPropagation();
    if (actionMenu?.alert.id === alert.id) {
      setActionMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const openUp = window.innerHeight - rect.bottom < 170;
    setActionMenu({
      alert,
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
      openUp,
    });
  };

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = alerts.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && a.source_app !== sourceFilter) return false;
      if (relevantOnly && a.relevance_score < 40) return false;
      if (q) {
        const hay = `${a.job_title} ${a.company_name} ${a.source_app}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const mult = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortField === 'relevance_score') {
        if (a.relevance_score !== b.relevance_score) {
          return (a.relevance_score - b.relevance_score) * mult;
        }
        return (b.received_at || '').localeCompare(a.received_at || '');
      }
      const av = String(a[sortField] || '').toLowerCase();
      const bv = String(b[sortField] || '').toLowerCase();
      if (av !== bv) return av.localeCompare(bv) * mult;
      return b.relevance_score - a.relevance_score;
    });

    return list;
  }, [alerts, statusFilter, sourceFilter, relevantOnly, search, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [statusFilter, sourceFilter, relevantOnly, search, sortField, sortDir, groupBy]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(1);
    }
  }, [page, totalPages]);

  const pagedAlerts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, page, pageSize]);

  useEffect(() => {
    const validIds = new Set(alerts.map((a) => a.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [alerts]);

  const lowScoreCount = useMemo(
    () => alerts.filter((a) => a.status === 'suggested' && a.relevance_score < 40).length,
    [alerts],
  );

  const pageAlertIds = useMemo(() => pagedAlerts.map((a) => a.id), [pagedAlerts]);
  const allOnPageSelected =
    pageAlertIds.length > 0 && pageAlertIds.every((id) => selectedIds.includes(id));

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectPage = () => {
    if (allOnPageSelected) {
      const pageSet = new Set(pageAlertIds);
      setSelectedIds((prev) => prev.filter((id) => !pageSet.has(id)));
    } else {
      setSelectedIds(Array.from(new Set([...selectedIds, ...pageAlertIds])));
    }
  };

  const runBulkAction = async (action: 'dismiss' | 'apply' | 'restore' | 'delete') => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await onBulkUpdateStatus(selectedIds, action);
      setSelectedIds([]);
    } finally {
      setBulkBusy(false);
    }
  };

  const groupedBuckets = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'All Alerts', tone: 'text-slate-800', order: 0, items: pagedAlerts }];
    }

    const map = new Map<
      string,
      { key: string; label: string; tone: string; order: number; items: JobAlert[] }
    >();

    for (const item of pagedAlerts) {
      let gKey = '';
      let gLabel = '';
      let gTone = 'text-slate-800';
      let gOrder = 99;

      if (groupBy === 'status') {
        gKey = item.status;
        gLabel = STATUS_META[item.status]?.label || item.status;
        gTone = STATUS_META[item.status]?.tone || 'text-slate-800';
        gOrder = STATUS_ORDER[item.status] ?? 99;
      } else if (groupBy === 'match_tier') {
        const tier = getMatchTier(item.relevance_score);
        gKey = tier.key;
        gLabel = tier.label;
        gTone = tier.tone;
        gOrder = tier.order;
      } else {
        gLabel = item.source_app?.trim() || 'Direct Alert';
        gKey = gLabel.toLowerCase();
      }

      if (!map.has(gKey)) {
        map.set(gKey, { key: gKey, label: gLabel, tone: gTone, order: gOrder, items: [] });
      }
      map.get(gKey)!.items.push(item);
    }

    const buckets = Array.from(map.values());
    if (groupBy === 'source_app') {
      return buckets.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
    }
    return buckets.sort((a, b) => a.order - b.order);
  }, [pagedAlerts, groupBy]);

  const handleGroupChange = (nextGroup: AlertGroupBy) => {
    setGroupBy(nextGroup);
  };

  const handleRescore = async () => {
    setRescoring(true);
    try {
      await onRescore();
    } finally {
      setRescoring(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Primary Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-[#eeece6]/60 dark:bg-slate-900/80 rounded-lg border border-[#e5e3dc] dark:border-slate-800 text-xs font-semibold">
          {(['suggested', 'applied', 'dismissed', 'all'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-md capitalize transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab
                  ? 'bg-white dark:bg-[#1c2436] text-stone-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter job titles..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 rounded-lg text-stone-800 dark:text-slate-200 w-48 focus:border-[#234aff] focus:ring-1 focus:ring-[#234aff] focus:outline-none shadow-2xs"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 rounded-lg text-stone-700 dark:text-slate-300 focus:border-[#234aff] focus:outline-none shadow-2xs"
          >
            <option value="all">All Source Apps</option>
            {sources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setRelevantOnly((v) => !v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 shadow-2xs ${
              relevantOnly
                ? 'bg-[#234aff]/10 dark:bg-blue-950/40 border-[#234aff]/25 dark:border-blue-900/60 text-[#234aff] dark:text-blue-300'
                : 'bg-white dark:bg-[#182030] border-[#e5e3dc] dark:border-slate-700 text-stone-700 dark:text-slate-300 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800'
            }`}
          >
            {relevantOnly ? 'Relevant Only (>=40%)' : 'Showing All Titles'}
          </button>

          <button
            type="button"
            onClick={handleRescore}
            disabled={rescoring}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 disabled:opacity-60 shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rescoring ? 'animate-spin' : ''}`} />
            Re-score
          </button>

          {alerts.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onOpenBatchDelete(
                  filteredAndSorted.map((a) => a.id),
                  Boolean(
                    statusFilter !== 'all' ||
                      sourceFilter !== 'all' ||
                      relevantOnly ||
                      search.trim(),
                  ),
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-white dark:bg-[#182030] border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg whitespace-nowrap shrink-0 shadow-2xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Batch Delete
            </button>
          )}

          {lowScoreCount > 0 && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={async () => {
                setBulkBusy(true);
                try {
                  await onDismissBelowScore(40);
                } finally {
                  setBulkBusy(false);
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 disabled:opacity-60 shadow-2xs transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Dismiss &lt;40% ({lowScoreCount})
            </button>
          )}
        </div>
      </div>

      {/* Sorting, Grouping & Selection Bar */}
      <div className="studio-card flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <label className="inline-flex items-center gap-1.5 text-stone-600 dark:text-slate-400 font-medium">
            <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
            <span>Sort</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as AlertSortField)}
              className="rounded-lg border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] px-2.5 py-1 text-xs text-stone-800 dark:text-slate-200 focus:border-[#234aff] focus:outline-none"
            >
              <option value="relevance_score">Match Score</option>
              <option value="received_at">Received Date</option>
              <option value="job_title">Job Title</option>
              <option value="company_name">Company</option>
              <option value="source_app">Source App</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="inline-flex items-center gap-1 rounded-lg border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] px-2.5 py-1 text-xs font-semibold text-stone-700 dark:text-slate-300 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 transition-colors shadow-2xs"
          >
            {sortDir === 'asc' ? (
              <>
                <ArrowUp className="w-3 h-3" />
                Asc
              </>
            ) : (
              <>
                <ArrowDown className="w-3 h-3" />
                Desc
              </>
            )}
          </button>

          <span className="h-4 w-px bg-[#e5e3dc] dark:bg-slate-700" aria-hidden="true" />

          <label className="inline-flex items-center gap-1.5 text-stone-600 dark:text-slate-400 font-medium">
            <Layers className="w-3.5 h-3.5 text-stone-400" />
            <span>Group by</span>
            <select
              value={groupBy}
              onChange={(e) => handleGroupChange(e.target.value as AlertGroupBy)}
              className="rounded-lg border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] px-2.5 py-1 text-xs text-stone-800 dark:text-slate-200 focus:border-[#234aff] focus:outline-none"
            >
              <option value="none">No Grouping</option>
              <option value="source_app">Source App</option>
              <option value="status">Status</option>
              <option value="match_tier">Match Tier</option>
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {pagedAlerts.length > 0 && (
            <label className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-slate-400 cursor-pointer select-none pr-1">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleSelectPage}
                className="rounded border-[#e5e3dc] dark:border-slate-600 bg-white dark:bg-slate-800 text-[#234aff] focus:ring-[#234aff]"
              />
              <span>Select page</span>
            </label>
          )}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#234aff]/25 dark:border-blue-900/60 bg-[#234aff]/5 dark:bg-blue-950/40 px-4 py-2.5 text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="font-mono-tabular font-bold text-[#234aff] dark:text-blue-300">
              {selectedIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-[#234aff] dark:text-blue-400 hover:underline font-medium"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => runBulkAction('apply')}
              className="btn-cobalt inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white rounded-lg disabled:opacity-60 shadow-xs transition-colors"
            >
              <Check className="w-3 h-3" />
              Mark Applied
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => runBulkAction('dismiss')}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-stone-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 rounded-lg disabled:opacity-60 shadow-2xs transition-colors"
            >
              <X className="w-3 h-3" />
              Dismiss
            </button>
            {statusFilter === 'dismissed' && (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => runBulkAction('restore')}
                className="px-3 py-1 text-xs font-semibold text-stone-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 rounded-lg disabled:opacity-60 shadow-2xs transition-colors"
              >
                Restore
              </button>
            )}
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => runBulkAction('delete')}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-white dark:bg-[#182030] border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg disabled:opacity-60 shadow-2xs transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      )}

      {filteredAndSorted.length === 0 ? (
        <div className="studio-card rounded-2xl p-10 text-center">
          <Briefcase className="w-6 h-6 text-stone-400 dark:text-slate-500 mx-auto mb-2.5" />
          <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100">No job alert recommendations yet</h3>
          <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Sync your inbox to find job titles from LinkedIn, Indeed, Wellfound, and other job alert emails.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedBuckets.map((bucket) => (
            <div key={bucket.key} className="studio-card rounded-xl overflow-hidden">
              {groupBy !== 'none' && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#eeece6]/40 dark:bg-slate-850 border-b border-[#e5e3dc] dark:border-slate-800">
                  <span className={`text-xs font-semibold ${bucket.tone}`}>{bucket.label}</span>
                  <span className="font-mono-tabular text-[11px] text-stone-500 dark:text-slate-400">
                    {bucket.items.length} on page
                  </span>
                </div>
              )}

              <div className="divide-y divide-[#e5e3dc]/70 dark:divide-slate-800/60">
                {bucket.items.map((item) => {
                  const scoreColor =
                    item.relevance_score >= 70
                      ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                      : item.relevance_score >= 40
                      ? 'text-[#234aff] dark:text-blue-400 font-bold'
                      : 'text-stone-500 dark:text-slate-400';
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 hover:bg-[#eeece6]/20 dark:hover:bg-slate-800/40 transition-colors ${
                        selectedIds.includes(item.id) ? 'bg-[#234aff]/5 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelectOne(item.id)}
                          aria-label={`Select ${item.job_title}`}
                          className="mt-1 rounded border-[#e5e3dc] dark:border-slate-600 bg-white dark:bg-slate-800 text-[#234aff] focus:ring-[#234aff] shrink-0"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-semibold text-stone-900 dark:text-slate-100">
                              {item.job_title}
                            </span>
                            {item.company_name && (
                              <span className="text-xs font-medium text-stone-700 dark:text-slate-300">
                                at {item.company_name}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                            <span className="font-medium text-[#234aff] dark:text-blue-400">
                              From {item.source_app}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className={`font-mono-tabular ${scoreColor}`}>
                              {item.relevance_score}% match
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">
                              {item.received_at.slice(0, 10)}
                            </span>
                            {item.relevance_reason && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span
                                  title={item.relevance_reason}
                                  className="text-stone-500 dark:text-slate-400 truncate max-w-xl cursor-help"
                                >
                                  {item.relevance_reason}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.job_url && (
                          <a
                            href={item.job_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Open original job listing"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 shadow-2xs transition-colors"
                          >
                            Open Job
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {item.status !== 'applied' ? (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(item.id, 'applied')}
                            className="btn-cobalt inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg whitespace-nowrap shrink-0 shadow-xs transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Mark Applied
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 px-2">
                            Added to Applied
                          </span>
                        )}

                        {item.status === 'suggested' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(item.id, 'dismissed')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-stone-600 dark:text-slate-400 border border-[#e5e3dc] dark:border-slate-700 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Dismiss
                          </button>
                        )}

                        {item.status === 'dismissed' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(item.id, 'suggested')}
                            className="px-2.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-slate-300 border border-[#e5e3dc] dark:border-slate-700 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                          >
                            Restore
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onDeleteAlert(item.id)}
                          title="Delete job alert"
                          aria-label={`Delete ${item.job_title}`}
                          className="inline-flex items-center justify-center p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 border border-[#e5e3dc] dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg shrink-0 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => openActionMenu(e, item)}
                          title="More actions (move misclassified alert)"
                          aria-label={`More actions for ${item.job_title}`}
                          aria-expanded={actionMenu?.alert.id === item.id}
                          className="inline-flex items-center justify-center p-1.5 text-stone-400 hover:text-stone-800 dark:hover:text-slate-200 border border-[#e5e3dc] dark:border-slate-700 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 rounded-lg shrink-0 transition-colors"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {actionMenu && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            top: `${actionMenu.top}px`,
            right: `${actionMenu.right}px`,
            transform: actionMenu.openUp ? 'translateY(-100%)' : undefined,
          }}
          className="fixed z-50 w-52 rounded-xl border border-[#e5e3dc] dark:border-slate-800 bg-white dark:bg-[#131926] py-1 shadow-xl animate-in fade-in-50 zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-slate-500">
            Move Misclassified Alert
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const targetAlert = actionMenu.alert;
              setActionMenu(null);
              onMoveWrongAlert(targetAlert, 'application');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-stone-700 dark:text-slate-300 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 transition-colors"
          >
            <Briefcase className="w-3.5 h-3.5 text-stone-500 dark:text-slate-400 shrink-0" />
            <span>Move to Application</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const targetAlert = actionMenu.alert;
              setActionMenu(null);
              onMoveWrongAlert(targetAlert, 'interview');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-[#234aff] dark:text-blue-400 hover:bg-[#234aff]/10 dark:hover:bg-blue-950/40 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-[#234aff] dark:text-blue-400 shrink-0" />
            <span>Move to Upcoming Interview</span>
          </button>
          <div className="my-1 border-t border-[#e5e3dc] dark:border-slate-800" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const targetAlert = actionMenu.alert;
              setActionMenu(null);
              onFilterEmail(targetAlert);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-rose-700 dark:text-rose-400 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 transition-colors"
          >
            <ShieldBan className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Filter Non-Career Email</span>
          </button>
        </div>
      )}

      <PaginationBar
        totalItems={filteredAndSorted.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        itemLabel="job alerts"
      />
    </div>
  );
};
