import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  Download,
  ExternalLink,
  Plus,
  ShieldBan,
  Trash2,
  X,
} from 'lucide-react';
import type { Interview, InterviewStatus } from '../types';
import { downloadCsv } from '../utils/appHelpers';

interface InterviewsViewProps {
  interviews: Interview[];
  onAddInterview: () => void;
  onUpdateStatus: (id: number, status: InterviewStatus) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onBulkDelete: (ids: number[]) => Promise<void>;
  onOpenBatchDelete: (filteredIds: number[], hasActiveFilter: boolean) => void;
  onFilterEmail: (iv: Interview) => void;
}

const STATUS_STYLE: Record<InterviewStatus, { label: string; color: string; badge: string }> = {
  upcoming: {
    label: 'Upcoming',
    color: 'text-[#234aff] dark:text-blue-400',
    badge: 'bg-[#234aff]/10 dark:bg-blue-950/40 text-[#234aff] dark:text-blue-300 border-[#234aff]/25 dark:border-blue-900',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700 dark:text-emerald-400',
    badge: 'bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-stone-600 dark:text-stone-400',
    badge: 'bg-stone-100 dark:bg-stone-850 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700',
  },
};

export const InterviewsView: React.FC<InterviewsViewProps> = ({
  interviews,
  onAddInterview,
  onUpdateStatus,
  onDelete,
  onBulkDelete,
  onOpenBatchDelete,
  onFilterEmail,
}) => {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = useMemo(
    () =>
      interviews.filter((iv) =>
        tab === 'upcoming' ? iv.status === 'upcoming' : iv.status !== 'upcoming',
      ),
    [interviews, tab],
  );

  useEffect(() => {
    const validIds = new Set(interviews.map((iv) => iv.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [interviews]);

  const visibleIds = useMemo(() => filtered.map((iv) => iv.id), [filtered]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleSelectOne = (id: number) => {
    setConfirmBulkDelete(false);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectVisible = () => {
    setConfirmBulkDelete(false);
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedIds(Array.from(new Set([...selectedIds, ...visibleIds])));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await onBulkDelete(selectedIds);
      setSelectedIds([]);
      setConfirmBulkDelete(false);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleCopy = async (id: number, link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-[#eeece6]/60 dark:bg-slate-900/80 rounded-lg border border-[#e5e3dc] dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTab('upcoming')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'upcoming'
                ? 'bg-white dark:bg-[#1c2436] text-stone-900 dark:text-white shadow-2xs'
                : 'text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200'
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setTab('past')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'past'
                ? 'bg-white dark:bg-[#1c2436] text-stone-900 dark:text-white shadow-2xs'
                : 'text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200'
            }`}
          >
            Past &amp; Cancelled
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {interviews.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => onOpenBatchDelete(visibleIds, true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-white dark:bg-[#131926] border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg whitespace-nowrap shrink-0 shadow-2xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Batch Delete
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `interviews-${new Date().toISOString().slice(0, 10)}.csv`,
                    ['Scheduled At', 'Timezone', 'Company', 'Role', 'Round', 'Status', 'Interviewer', 'Meeting Link', 'Job Link'],
                    interviews.map((iv) => [
                      iv.scheduled_at,
                      iv.timezone,
                      iv.company,
                      iv.role_title,
                      iv.round_label,
                      iv.status,
                      iv.interviewer_names,
                      iv.meeting_link,
                      iv.job_url,
                    ]),
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-slate-300 bg-white dark:bg-[#131926] border border-[#e5e3dc] dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onAddInterview}
            className="btn-cobalt inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg whitespace-nowrap shrink-0 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Interview
          </button>
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
              onClick={() => {
                setSelectedIds([]);
                setConfirmBulkDelete(false);
              }}
              className="text-[#234aff] dark:text-blue-400 hover:underline font-medium"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center gap-2">
            {confirmBulkDelete ? (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-60 shadow-2xs transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Confirm Delete ({selectedIds.length})
              </button>
            ) : (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setConfirmBulkDelete(true)}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-white dark:bg-[#182030] border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg shadow-2xs disabled:opacity-60 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="studio-card rounded-2xl p-10 text-center">
          <Calendar className="w-6 h-6 text-stone-400 dark:text-slate-500 mx-auto mb-2.5" />
          <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100">
            {tab === 'upcoming' ? 'No upcoming interviews scheduled' : 'No past or cancelled interviews'}
          </h3>
          <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Sync your email inbox to add interview invites automatically, or add one yourself.
          </p>
          {tab === 'upcoming' && (
            <button
              type="button"
              onClick={onAddInterview}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-slate-200 bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Schedule Interview
            </button>
          )}
        </div>
      ) : (
        <div className="studio-card rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e3dc] dark:border-slate-800 bg-[#eeece6]/40 dark:bg-slate-850 text-[11px] font-semibold text-stone-500 dark:text-slate-400">
                <th className="py-2.5 pl-4 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectVisible}
                    aria-label="Select all interviews"
                    className="rounded border-[#e5e3dc] dark:border-slate-600 bg-white dark:bg-slate-800 text-[#234aff] focus:ring-[#234aff]"
                  />
                </th>
                <th className="py-2.5 px-4">Date &amp; Time</th>
                <th className="py-2.5 px-4">Company &amp; Role</th>
                <th className="py-2.5 px-4">Round</th>
                <th className="py-2.5 px-4">Interviewer</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e3dc]/70 dark:divide-slate-800/70 text-sm">
              {filtered.map((iv) => {
                const st = STATUS_STYLE[iv.status] || STATUS_STYLE.upcoming;
                const formatted = iv.scheduled_at.replace('T', ' ');
                const checked = selectedIds.includes(iv.id);
                return (
                  <tr
                    key={iv.id}
                    className={`hover:bg-[#eeece6]/20 dark:hover:bg-slate-800/40 transition-colors ${checked ? 'bg-[#234aff]/5 dark:bg-[#234aff]/15' : ''}`}
                  >
                    <td className="py-3 pl-4 pr-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelectOne(iv.id)}
                        aria-label={`Select ${iv.company} ${iv.role_title}`}
                        className="rounded border-[#e5e3dc] dark:border-slate-600 bg-white dark:bg-slate-800 text-[#234aff] focus:ring-[#234aff]"
                      />
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-stone-900 dark:text-slate-200 whitespace-nowrap">
                      {formatted}
                      {iv.timezone ? ` ${iv.timezone}` : ''}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-stone-900 dark:text-slate-100 text-sm">{iv.company}</div>
                      <div className="text-xs text-stone-500 dark:text-slate-400">{iv.role_title}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-700 dark:text-slate-300 font-medium">{iv.round_label}</td>
                    <td className="py-3 px-4 text-xs text-stone-600 dark:text-slate-400">
                      {iv.interviewer_names || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${st.badge}`}>{st.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {iv.job_url && (
                          <a
                            href={iv.job_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Open job listing or portal"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-stone-700 dark:text-slate-300 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 border border-[#e5e3dc] dark:border-slate-700 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                          >
                            Job
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {iv.meeting_link && (
                          <>
                            <a
                              href={iv.meeting_link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#234aff] dark:text-blue-400 hover:bg-[#234aff]/10 dark:hover:bg-blue-950/40 border border-[#234aff]/25 dark:border-blue-900/60 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                            >
                              Join
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopy(iv.id, iv.meeting_link)}
                              className="p-1.5 text-stone-400 hover:text-stone-800 dark:hover:text-slate-200 rounded-lg hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 transition-colors"
                              title="Copy meeting link"
                            >
                              {copiedId === iv.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </>
                        )}

                        {iv.status === 'upcoming' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(iv.id, 'completed')}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(iv.id, 'cancelled')}
                              className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 transition-colors"
                              title="Mark cancelled"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => onFilterEmail(iv)}
                          className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-slate-300 rounded-lg hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 transition-colors"
                          title="Filter non-career email"
                        >
                          <ShieldBan className="w-3.5 h-3.5" />
                        </button>

                        {confirmDeleteId === iv.id ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await onDelete(iv.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(iv.id)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 transition-colors"
                            title="Delete interview"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
