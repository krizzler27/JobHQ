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
  application_update: 'text-blue-700',
  interview: 'text-emerald-700',
  job_alert: 'text-slate-700',
  ignored: 'text-slate-400',
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
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md w-64 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCategory(tab.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                  category === tab.key
                    ? 'bg-white text-slate-900 border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {clearingIgnored ? 'Clearing...' : 'Confirm Clear Ignored'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearIgnored(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Force Re-scan
            </button>
          )}
          <button
            type="button"
            onClick={loadLog}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Recent Scanned Emails</h2>
          </div>
          <span className="font-mono-tabular text-xs text-slate-500">
            {total} total
          </span>
        </div>

        {loading && emails.length === 0 ? (
          <div className="p-6 space-y-2.5">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="h-9 rounded bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-xs text-slate-500">
              {category === 'all' && !search.trim()
                ? 'No emails scanned yet. Connect your email and click Sync Inbox.'
                : 'No scanned emails match the selected filter.'}
            </p>
            {category === 'all' && !search.trim() && onSyncInbox && (
              <button
                type="button"
                onClick={onSyncInbox}
                disabled={syncing}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md whitespace-nowrap disabled:opacity-60"
              >
                {syncing ? 'Syncing...' : 'Sync Inbox'}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">From</th>
                  <th className="py-2.5 px-4">Subject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {emails.map((em) => (
                  <tr key={em.message_id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono-tabular text-slate-500 whitespace-nowrap">
                      {(em.received_at || em.processed_at).slice(0, 10)}
                    </td>
                    <td
                      className={`py-2.5 px-4 font-medium whitespace-nowrap ${
                        CATEGORY_TONE[em.category] || 'text-slate-700'
                      }`}
                    >
                      {CATEGORY_LABEL[em.category] || em.category.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-[240px] truncate" title={em.sender}>
                      {em.sender || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 max-w-xl truncate" title={em.subject}>
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
