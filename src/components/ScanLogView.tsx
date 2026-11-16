import React, { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw, Search, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { ProcessedEmail } from '../types';
import { PaginationBar } from './PaginationBar';

interface ScanLogViewProps {
  refreshKey?: number;
  syncing?: boolean;
  onSyncInbox?: () => void;
  onForceRescan?: () => void;
}

type CategoryFilter = 'all' | 'application_update' | 'interview' | 'job_alert' | 'ignored';

const CATEGORY_TABS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'application_update', label: 'Application Updates' },
  { key: 'interview', label: 'Interviews' },
  { key: 'job_alert', label: 'Job Alerts' },
  { key: 'ignored', label: 'Ignored / Filtered' },
];

const CATEGORY_LABEL: Record<ProcessedEmail['category'], string> = {
  application_update: 'Application Update',
  interview: 'Interview',
  job_alert: 'Job Alert',
  ignored: 'Ignored',
};

const CATEGORY_TONE: Record<ProcessedEmail['category'], string> = {
  application_update: 'text-blue-700 dark:text-blue-400',
  interview: 'text-emerald-700 dark:text-emerald-400',
  job_alert: 'text-slate-700 dark:text-slate-300',
  ignored: 'text-slate-400 dark:text-slate-500',
};

export const ScanLogView: React.FC<ScanLogViewProps> = ({
  refreshKey = 0,
  syncing = false,
  onSyncInbox,
  onForceRescan,
}) => {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [emails, setEmails] = useState<ProcessedEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [clearingIgnored, setClearingIgnored] = useState(false);
  const [confirmClearIgnored, setConfirmClearIgnored] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setPage(1);
  }, [category, search]);

  const loadLog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getEmailLog({
        category,
        search,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setEmails(res.emails);
      setTotal(res.total ?? res.emails.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load scanned emails.');
    } finally {
      setLoading(false);
    }
  }, [category, search, page, pageSize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLog();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadLog, refreshKey]);

  const handleClearIgnored = async () => {
    setClearingIgnored(true);
    setError('');
    setNotice('');
    try {
      const res = await api.clearIgnoredEmails();
      setConfirmClearIgnored(false);
      setNotice(`Cleared ${res.deleted} ignored email log(s).`);
      setPage(1);
      await loadLog();
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear ignored logs.');
    } finally {
      setClearingIgnored(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sender or subject..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#182030] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 w-64 focus:border-blue-600 focus:outline-none shadow-2xs"
            />
          </div>

          <div className="inline-flex flex-wrap items-center gap-0.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-lg border border-slate-200/60 dark:border-slate-800 text-xs font-semibold">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCategory(tab.key)}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 transition-colors ${
                  category === tab.key
                    ? 'bg-white dark:bg-[#1c2436] text-slate-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {confirmClearIgnored ? (
            <button
              type="button"
              onClick={handleClearIgnored}
              disabled={clearingIgnored}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg whitespace-nowrap shrink-0 disabled:opacity-60 shadow-2xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {clearingIgnored ? 'Clearing...' : 'Confirm Clear Ignored'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearIgnored(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 shadow-2xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Ignored
            </button>
          )}
          {onForceRescan && (
            <button
              type="button"
              onClick={onForceRescan}
              disabled={syncing}
              title="Re-check recent emails including previously skipped ones"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 rounded-lg whitespace-nowrap shrink-0 disabled:opacity-60 shadow-2xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Force Re-scan
            </button>
          )}
          <button
            type="button"
            onClick={loadLog}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 disabled:opacity-60 shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300 shadow-2xs">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs font-medium text-rose-800 dark:text-rose-300 shadow-2xs">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] overflow-hidden shadow-2xs">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Scanned Emails</h2>
          </div>
          <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
            {total} total
          </span>
        </div>

        {loading && emails.length === 0 ? (
          <div className="p-6 space-y-2.5">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="h-9 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {category === 'all' && !search.trim()
                ? 'No emails scanned yet. Connect your email and click Sync Inbox.'
                : 'No scanned emails match the selected filter.'}
            </p>
            {category === 'all' && !search.trim() && onSyncInbox && (
              <button
                type="button"
                onClick={onSyncInbox}
                disabled={syncing}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap disabled:opacity-60 shadow-2xs transition-colors"
              >
                {syncing ? 'Syncing...' : 'Sync Inbox'}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-850 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">From</th>
                  <th className="py-2.5 px-4">Subject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {emails.map((em) => (
                  <tr key={em.message_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-mono-tabular text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {(em.received_at || em.processed_at).slice(0, 10)}
                    </td>
                    <td
                      className={`py-2.5 px-4 font-semibold whitespace-nowrap ${
                        CATEGORY_TONE[em.category] || 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {CATEGORY_LABEL[em.category] || em.category.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 max-w-[240px] truncate" title={em.sender}>
                      {em.sender || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 dark:text-slate-100 font-medium max-w-xl truncate" title={em.subject}>
                      {em.subject || '(No Subject)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaginationBar
        totalItems={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        itemLabel="scanned emails"
      />
    </div>
  );
};
