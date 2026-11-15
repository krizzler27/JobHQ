import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  Layers,
  Trash2,
} from 'lucide-react';
import { APPLICATION_STAGES } from '../api';
import type { Application, ApplicationStatus } from '../types';
import { getDaysSinceUpdate, isStaleApplication } from '../utils/appHelpers';
import { PaginationBar } from './PaginationBar';

export type AppSortField =
  | 'last_update_date'
  | 'applied_date'
  | 'role_title'
  | 'company'
  | 'status'
  | 'source_platform'
  | 'location';

export type AppGroupBy = 'none' | 'status' | 'source_platform' | 'company';

interface ApplicationsTableViewProps {
  applications: Application[];
  stageTone: Record<ApplicationStatus, string>;
  onMoveStage: (appId: number, status: ApplicationStatus) => Promise<void>;
  onBulkMoveStage: (ids: number[], status: ApplicationStatus) => Promise<void>;
  onBulkDelete: (ids: number[]) => Promise<void>;
  onSelectApplication: (app: Application) => void;
}

const STAGE_ORDER: Record<ApplicationStatus, number> = {
  applied: 0,
  interviewing: 1,
  offer: 2,
  rejected: 3,
  ghosted: 4,
};

const STAGE_LABEL: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
};

export const ApplicationsTableView: React.FC<ApplicationsTableViewProps> = ({
  applications,
  stageTone,
  onMoveStage,
  onBulkMoveStage,
  onBulkDelete,
  onSelectApplication,
}) => {
  const [sortField, setSortField] = useState<AppSortField>('last_update_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<AppGroupBy>('none');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkTargetStage, setBulkTargetStage] = useState<ApplicationStatus>('rejected');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSort = (field: AppSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'last_update_date' || field === 'applied_date' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const handleGroupChange = (nextGroup: AppGroupBy) => {
    setGroupBy(nextGroup);
    setPage(1);
  };

  const sortedApps = useMemo(() => {
    const copy = [...applications];
    const mult = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      if (sortField === 'status') {
        const diff = STAGE_ORDER[a.status] - STAGE_ORDER[b.status];
        if (diff !== 0) return diff * mult;
      } else {
        const av = String(a[sortField] || '').toLowerCase();
        const bv = String(b[sortField] || '').toLowerCase();
        if (av !== bv) return av.localeCompare(bv) * mult;
      }
      return (b.updated_at || '').localeCompare(a.updated_at || '');
    });
    return copy;
  }, [applications, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedApps.length / pageSize));
  useEffect(() => {
    if (page > totalPages) {
      setPage(1);
    }
  }, [page, totalPages]);

  const pagedApps = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedApps.slice(start, start + pageSize);
  }, [sortedApps, page, pageSize]);

  useEffect(() => {
    const validIds = new Set(applications.map((a) => a.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [applications]);

  const pageIds = useMemo(() => pagedApps.map((a) => a.id), [pagedApps]);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const toggleSelectOne = (id: number) => {
    setConfirmDelete(false);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectPage = () => {
    setConfirmDelete(false);
    if (allOnPageSelected) {
      const pageSet = new Set(pageIds);
      setSelectedIds((prev) => prev.filter((id) => !pageSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...pageIds]);
      setSelectedIds(Array.from(merged));
    }
  };

  const handleBulkMove = async () => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await onBulkMoveStage(selectedIds, bulkTargetStage);
      setSelectedIds([]);
      setConfirmDelete(false);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await onBulkDelete(selectedIds);
      setSelectedIds([]);
      setConfirmDelete(false);
    } finally {
      setBulkBusy(false);
    }
  };

  const groupedBuckets = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'All Applications', tone: 'text-slate-800', items: pagedApps }];
    }

    const map = new Map<string, { key: string; label: string; tone: string; items: Application[] }>();
    if (groupBy === 'status') {
      for (const st of APPLICATION_STAGES) {
        map.set(st.key, { key: st.key, label: st.label, tone: st.tone, items: [] });
      }
    }

    for (const app of pagedApps) {
      let gKey = '';
      let gLabel = '';
      let gTone = 'text-slate-800';
      if (groupBy === 'status') {
        gKey = app.status;
        gLabel = STAGE_LABEL[app.status] || app.status;
        gTone = stageTone[app.status] || 'text-slate-800';
      } else if (groupBy === 'source_platform') {
        gLabel = app.source_platform?.trim() || 'Direct / Other';
        gKey = gLabel.toLowerCase();
      } else {
        gLabel = app.company?.trim() || 'Unknown Company';
        gKey = gLabel.toLowerCase();
      }

      if (!map.has(gKey)) {
        map.set(gKey, { key: gKey, label: gLabel, tone: gTone, items: [] });
      }
      map.get(gKey)!.items.push(app);
    }

    const buckets = Array.from(map.values());
    if (groupBy === 'status') {
      return buckets.filter((b) => b.items.length > 0);
    }
    return buckets.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  }, [pagedApps, groupBy, stageTone]);

  const SortIcon: React.FC<{ field: AppSortField }> = ({ field }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 inline ml-1" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600 inline ml-1" />
    );
  };

  return (
    <div className="space-y-3">
      {/* Table Controls: Sort & Group By */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <label className="inline-flex items-center gap-1.5 text-slate-600">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Sort</span>
            <select
              value={sortField}
              onChange={(e) => {
                setSortField(e.target.value as AppSortField);
                setPage(1);
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="last_update_date">Last Updated</option>
              <option value="applied_date">Applied Date</option>
              <option value="role_title">Role Title</option>
              <option value="company">Company</option>
              <option value="status">Stage</option>
              <option value="source_platform">Source</option>
              <option value="location">Location</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
              setPage(1);
            }}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
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

          <span className="h-4 w-px bg-slate-200" aria-hidden="true" />

          <label className="inline-flex items-center gap-1.5 text-slate-600">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Group by</span>
            <select
              value={groupBy}
              onChange={(e) => handleGroupChange(e.target.value as AppGroupBy)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="none">No Grouping</option>
              <option value="status">Stage</option>
              <option value="source_platform">Source</option>
              <option value="company">Company</option>
            </select>
          </label>
        </div>
      </div>

      {/* Bulk Selection Action Bar */}
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
                setConfirmDelete(false);
              }}
              className="text-blue-700 hover:underline"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkTargetStage}
              onChange={(e) => setBulkTargetStage(e.target.value as ApplicationStatus)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              {APPLICATION_STAGES.map((st) => (
                <option key={st.key} value={st.key}>
                  Move to {st.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={handleBulkMove}
              className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-60"
            >
              Apply Stage
            </button>

            {confirmDelete ? (
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
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 rounded disabled:opacity-60"
              >
                <Trash2 className="w-3 h-3" />
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table Rows Layout (Flat or Grouped Sections) */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 select-none">
                <th className="py-2.5 pl-4 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectPage}
                    aria-label="Select all on page"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('role_title')}
                    className="inline-flex items-center hover:text-slate-900"
                  >
                    Role & Company
                    <SortIcon field="role_title" />
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('status')}
                    className="inline-flex items-center hover:text-slate-900"
                  >
                    Stage
                    <SortIcon field="status" />
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('source_platform')}
                    className="inline-flex items-center hover:text-slate-900"
                  >
                    Source
                    <SortIcon field="source_platform" />
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('location')}
                    className="inline-flex items-center hover:text-slate-900"
                  >
                    Location
                    <SortIcon field="location" />
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('applied_date')}
                    className="inline-flex items-center hover:text-slate-900"
                  >
                    Applied
                    <SortIcon field="applied_date" />
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('last_update_date')}
                    className="inline-flex items-center hover:text-slate-900"
                  >
                    Updated
                    <SortIcon field="last_update_date" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {groupedBuckets.map((bucket) => (
                <React.Fragment key={bucket.key}>
                  {groupBy !== 'none' && (
                    <tr className="bg-slate-50/90 border-y border-slate-200">
                      <td colSpan={7} className="py-2 px-4">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${bucket.tone}`}>
                            {bucket.label}
                          </span>
                          <span className="font-mono-tabular text-[11px] text-slate-500">
                            {bucket.items.length} on page
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {bucket.items.map((app) => {
                    const stale = isStaleApplication(app);
                    const daysOld = getDaysSinceUpdate(app);
                    const checked = selectedIds.includes(app.id);
                    return (
                      <tr
                        key={app.id}
                        onClick={() => onSelectApplication(app)}
                        className={`cursor-pointer hover:bg-slate-50/70 ${
                          checked ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <td
                          className="py-3 pl-4 pr-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelectOne(app.id)}
                            aria-label={`Select ${app.role_title}`}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{app.role_title}</span>
                            {app.job_url && (
                              <a
                                href={app.job_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Open job or application portal link"
                                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:underline shrink-0"
                              >
                                Link
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{app.company}</div>
                        </td>
                        <td
                          className="py-3 px-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={app.status}
                            onChange={(e) =>
                              onMoveStage(app.id, e.target.value as ApplicationStatus)
                            }
                            className={`text-xs font-medium bg-transparent border border-slate-200 rounded px-2 py-1 focus:border-blue-600 focus:outline-none ${
                              stageTone[app.status]
                            }`}
                          >
                            {APPLICATION_STAGES.map((st) => (
                              <option key={st.key} value={st.key} className="text-slate-900">
                                {st.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {app.source_platform || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {app.location || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600">
                          {app.applied_date || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600">
                          <div>{app.last_update_date || '—'}</div>
                          {stale && (
                            <div className="text-[11px] font-medium text-amber-700 mt-0.5">
                              {daysOld}d+ stale
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

      <PaginationBar
        totalItems={sortedApps.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        itemLabel="applications"
      />
    </div>
  );
};
