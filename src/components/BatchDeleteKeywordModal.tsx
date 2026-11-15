import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Search, Trash2, X } from 'lucide-react';

export interface BatchDeleteCandidateItem {
  id: number;
  title: string;
  subtitle: string;
  meta?: string;
  fields: {
    title: string;
    company: string;
    extra: string;
  };
}

interface BatchDeleteKeywordModalProps {
  open: boolean;
  entityLabel: 'Applications' | 'Interviews' | 'Job Alerts';
  allItems: BatchDeleteCandidateItem[];
  filteredIds: number[];
  hasActiveFilter: boolean;
  onClose: () => void;
  onConfirmDelete: (ids: number[]) => Promise<void>;
}

export const BatchDeleteKeywordModal: React.FC<BatchDeleteKeywordModalProps> = ({
  open,
  entityLabel,
  allItems,
  filteredIds,
  hasActiveFilter,
  onClose,
  onConfirmDelete,
}) => {
  const [keywordInput, setKeywordInput] = useState('');
  const [matchTitle, setMatchTitle] = useState(true);
  const [matchCompany, setMatchCompany] = useState(true);
  const [matchExtra, setMatchExtra] = useState(true);
  const [onlyCurrentFilter, setOnlyCurrentFilter] = useState(hasActiveFilter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setKeywordInput('');
    setMatchTitle(true);
    setMatchCompany(true);
    setMatchExtra(true);
    setOnlyCurrentFilter(hasActiveFilter);
    setError('');
  }, [open, hasActiveFilter]);

  const parsedKeywords = useMemo(
    () =>
      keywordInput
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    [keywordInput],
  );

  const filteredIdSet = useMemo(() => new Set(filteredIds), [filteredIds]);

  const pool = useMemo(() => {
    if (hasActiveFilter && onlyCurrentFilter) {
      return allItems.filter((item) => filteredIdSet.has(item.id));
    }
    return allItems;
  }, [allItems, hasActiveFilter, onlyCurrentFilter, filteredIdSet]);

  const matches = useMemo(() => {
    if (parsedKeywords.length === 0) return [];
    if (!matchTitle && !matchCompany && !matchExtra) return [];

    return pool.filter((item) => {
      const chunks: string[] = [];
      if (matchTitle) chunks.push(item.fields.title);
      if (matchCompany) chunks.push(item.fields.company);
      if (matchExtra) chunks.push(item.fields.extra);
      const hay = chunks.join(' ').toLowerCase();
      return parsedKeywords.some((kw) => hay.includes(kw));
    });
  }, [pool, parsedKeywords, matchTitle, matchCompany, matchExtra]);

  if (!open) return null;

  const handleDelete = async () => {
    if (matches.length === 0) return;
    setBusy(true);
    setError('');
    try {
      await onConfirmDelete(matches.map((m) => m.id));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch delete failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white overflow-hidden my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Batch Delete {entityLabel} by Title or Keyword
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Preview matching entries before permanently removing them.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Title or Keyword(s) to Match (comma-separated for multiple)
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder="e.g. intern, sales, newsletter, contract"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-slate-300 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
            <span className="font-medium text-slate-500">Search in:</span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={matchTitle}
                onChange={(e) => setMatchTitle(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Title / Role</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={matchCompany}
                onChange={(e) => setMatchCompany(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Company</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={matchExtra}
                onChange={(e) => setMatchExtra(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Source / Subject</span>
            </label>
          </div>

          {hasActiveFilter && (
            <label className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 cursor-pointer">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyCurrentFilter}
                  onChange={(e) => setOnlyCurrentFilter(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Only match items in the current view filter</span>
              </span>
              <span className="font-mono-tabular text-[11px] text-slate-500">
                {onlyCurrentFilter ? `${filteredIds.length} in view` : `${allItems.length} total`}
              </span>
            </label>
          )}

          {/* Match Preview Box */}
          <div className="rounded-md border border-slate-200 bg-slate-50/70 overflow-hidden">
            <div className="px-3.5 py-2 border-b border-slate-200 bg-white flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800">Match Preview</span>
              <span className="font-mono-tabular text-slate-600">
                {parsedKeywords.length === 0 ? (
                  'Enter keyword(s) above'
                ) : (
                  <>
                    <strong className={matches.length > 0 ? 'text-rose-700' : 'text-slate-900'}>
                      {matches.length}
                    </strong>{' '}
                    of {pool.length} matched
                  </>
                )}
              </span>
            </div>

            {parsedKeywords.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Type a job title or keyword (e.g. &ldquo;intern&rdquo; or &ldquo;unpaid, spam&rdquo;) to preview matching entries.
              </div>
            ) : matches.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No {entityLabel.toLowerCase()} match {parsedKeywords.map((k) => `"${k}"`).join(' or ')}.
              </div>
            ) : (
              <div className="divide-y divide-slate-200/70 max-h-56 overflow-y-auto">
                {matches.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="px-3.5 py-2 flex items-center justify-between gap-3 text-xs bg-white/70"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{item.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                    </div>
                    {item.meta && (
                      <span className="font-mono-tabular text-[11px] text-slate-500 shrink-0">
                        {item.meta}
                      </span>
                    )}
                  </div>
                ))}
                {matches.length > 6 && (
                  <div className="px-3.5 py-2 text-[11px] text-slate-500 bg-slate-50 text-center font-mono-tabular">
                    +{matches.length - 6} more matching item{matches.length - 6 === 1 ? '' : 's'}
                  </div>
                )}
              </div>
            )}
          </div>

          {matches.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                This will permanently delete <strong>{matches.length}</strong>{' '}
                {entityLabel.toLowerCase()} from your workspace.
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy || matches.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {busy
                ? 'Deleting...'
                : `Delete ${matches.length} Matching ${matches.length === 1 ? 'Item' : 'Items'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
