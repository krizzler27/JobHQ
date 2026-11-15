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

const STATUS_STYLE: Record<InterviewStatus, { label: string; color: string }> = {
  upcoming: { label: 'Upcoming', color: 'text-blue-700' },
  completed: { label: 'Completed', color: 'text-emerald-700' },
  cancelled: { label: 'Cancelled', color: 'text-rose-700' },
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
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => setTab('upcoming')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              tab === 'upcoming'
                ? 'bg-white text-slate-900 border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setTab('past')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              tab === 'past'
                ? 'bg-white text-slate-900 border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
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
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 rounded-md whitespace-nowrap shrink-0"
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
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onAddInterview}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Interview
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/80 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono-tabular font-semibold text-blue-800">
              {selectedIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setConfirmBulkDelete(false);
              }}
              className="text-blue-700 hover:underline"
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
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded disabled:opacity-60"
              >
                <Trash2 className="w-3 h-3" />
                Confirm Delete ({selectedIds.length})
              </button>
            ) : (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setConfirmBulkDelete(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 rounded disabled:opacity-60"
              >
                <Trash2 className="w-3 h-3" />
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <Calendar className="w-6 h-6 text-slate-400 mx-auto mb-2.5" />
          <h3 className="text-sm font-semibold text-slate-900">
            {tab === 'upcoming' ? 'No upcoming interviews scheduled' : 'No past or cancelled interviews'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Sync your email inbox to add interview invites automatically, or add one yourself.
          </p>
          {tab === 'upcoming' && (
            <button
              type="button"
              onClick={onAddInterview}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md"
            >
              <Plus className="w-3.5 h-3.5" />
              Schedule Interview
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 pl-4 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectVisible}
                    aria-label="Select all interviews"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((iv) => {
                const st = STATUS_STYLE[iv.status] || STATUS_STYLE.upcoming;
                const formatted = iv.scheduled_at.replace('T', ' ');
                const checked = selectedIds.includes(iv.id);
                return (
                  <tr
                    key={iv.id}
                    className={`hover:bg-slate-50/70 ${checked ? 'bg-blue-50/30' : ''}`}
                  >
                    <td className="py-3 pl-4 pr-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelectOne(iv.id)}
                        aria-label={`Select ${iv.company} ${iv.role_title}`}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-slate-900 whitespace-nowrap">
                      {formatted}
                      {iv.timezone ? ` ${iv.timezone}` : ''}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 text-sm">{iv.company}</div>
                      <div className="text-xs text-slate-500">{iv.role_title}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">{iv.round_label}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {iv.interviewer_names || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {iv.job_url && (
                          <a
                            href={iv.job_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Open job listing or portal"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded whitespace-nowrap shrink-0"
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded whitespace-nowrap shrink-0"
                            >
                              Join
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopy(iv.id, iv.meeting_link)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                              title="Copy meeting link"
                            >
                              {copiedId === iv.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
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
                              className="px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded whitespace-nowrap shrink-0"
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(iv.id, 'cancelled')}
                              className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100"
                              title="Mark cancelled"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => onFilterEmail(iv)}
                          className="p-1.5 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100"
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
                            className="px-2 py-1 text-xs font-medium text-white bg-rose-600 rounded whitespace-nowrap shrink-0"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(iv.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
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
