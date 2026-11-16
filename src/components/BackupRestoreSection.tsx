import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Upload,
} from 'lucide-react';
import { api } from '../api';
import { formatLocalDateTime } from '../utils/appHelpers';

export interface BackupRestoreSectionProps {
  onDataRestored: () => Promise<void>;
}

export const BackupRestoreSection: React.FC<BackupRestoreSectionProps> = ({
  onDataRestored,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [downloadingSqlite, setDownloadingSqlite] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupNotice, setBackupNotice] = useState('');
  const [pendingBackup, setPendingBackup] = useState<{
    filename: string;
    exportedAt: string;
    appsCount: number;
    ivsCount: number;
    alertsCount: number;
    hasProfile: boolean;
    raw: Record<string, unknown>;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [includeProfile, setIncludeProfile] = useState(true);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleDownloadJson = async () => {
    setDownloadingJson(true);
    setBackupError('');
    setBackupNotice('');
    try {
      await api.downloadBackupFile('json');
      setBackupNotice('Downloaded portable JSON backup.');
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to export JSON backup.');
    } finally {
      setDownloadingJson(false);
    }
  };

  const handleDownloadSqlite = async () => {
    setDownloadingSqlite(true);
    setBackupError('');
    setBackupNotice('');
    try {
      await api.downloadBackupFile('sqlite');
      setBackupNotice('Downloaded SQLite database snapshot (.db).');
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to download SQLite database.');
    } finally {
      setDownloadingSqlite(false);
    }
  };

  const handleSelectBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setBackupError('');
    setBackupNotice('');
    setConfirmReplace(false);
    if (!file) {
      setPendingBackup(null);
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Backup file must contain a JSON object.');
      }
      const dataObj =
        parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      const apps = Array.isArray(dataObj.applications) ? dataObj.applications : null;
      const ivs = Array.isArray(dataObj.interviews) ? dataObj.interviews : null;
      const alerts = Array.isArray(dataObj.job_alerts) ? dataObj.job_alerts : null;
      if (!apps || !ivs || !alerts) {
        throw new Error(
          'Unrecognized backup structure. Expected applications, interviews, and job_alerts lists.',
        );
      }
      setPendingBackup({
        filename: file.name,
        exportedAt: typeof parsed.exported_at === 'string' ? parsed.exported_at : '',
        appsCount: apps.length,
        ivsCount: ivs.length,
        alertsCount: alerts.length,
        hasProfile: Boolean(
          dataObj.profile_settings && typeof dataObj.profile_settings === 'object',
        ),
        raw: parsed as Record<string, unknown>,
      });
    } catch (err) {
      setPendingBackup(null);
      setBackupError(
        err instanceof Error ? err.message : 'Could not read the selected JSON backup file.',
      );
    }
  };

  const handleRestoreBackup = async () => {
    if (!pendingBackup) return;
    if (restoreMode === 'replace' && !confirmReplace) return;
    setRestoring(true);
    setBackupError('');
    setBackupNotice('');
    try {
      const res = await api.importJsonBackup({
        mode: restoreMode,
        include_profile: includeProfile,
        backup: pendingBackup.raw,
      });
      await onDataRestored();
      const skippedTotal =
        res.skipped.applications + res.skipped.interviews + res.skipped.job_alerts;
      const parts = [
        `Added ${res.added.applications} applications, ${res.added.interviews} interviews, ${res.added.job_alerts} job alerts`,
      ];
      if (skippedTotal > 0) {
        parts.push(`skipped ${skippedTotal} duplicates`);
      }
      if (res.profile_updated) {
        parts.push('updated profile goals');
      }
      setBackupNotice(`Restore complete: ${parts.join(' · ')}.`);
      setPendingBackup(null);
      setConfirmReplace(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Backup restore failed.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] p-6 space-y-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <Database className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">Data Backup &amp; Restore</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Download a portable JSON backup (IMAP passwords excluded for safety) or snapshot the full SQLite database.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadJson}
            disabled={downloadingJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap disabled:opacity-60 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {downloadingJson ? 'Exporting...' : 'Export JSON'}
          </button>

          <button
            type="button"
            onClick={handleDownloadSqlite}
            disabled={downloadingSqlite}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap disabled:opacity-60 shadow-2xs transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            {downloadingSqlite ? 'Snapshotting...' : 'Download .db'}
          </button>
        </div>
      </div>

      {backupError && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs font-medium text-rose-800 dark:text-rose-300 shadow-2xs">
          {backupError}
        </div>
      )}

      {backupNotice && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{backupNotice}</span>
        </div>
      )}

      <div className="pt-5 border-t border-slate-200/80 dark:border-slate-800/80 space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Restore from JSON Backup</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Choose a previously exported <span className="font-mono-tabular">.json</span> backup file to merge missing entries or restore your pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleSelectBackupFile}
            className="text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 dark:file:border-slate-700 file:text-xs file:font-semibold file:bg-white dark:file:bg-[#182030] file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-50 dark:hover:file:bg-slate-800 cursor-pointer shadow-2xs"
          />
        </div>

        {pendingBackup && (
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0e1420]/70 p-4 space-y-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {pendingBackup.filename}
              </div>
              {pendingBackup.exportedAt && (
                <span className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                  Exported {formatLocalDateTime(pendingBackup.exportedAt)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tabular text-slate-700 dark:text-slate-300">
              <span>
                <strong className="text-slate-900 dark:text-slate-100">{pendingBackup.appsCount}</strong> applications
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span>
                <strong className="text-slate-900 dark:text-slate-100">{pendingBackup.ivsCount}</strong> interviews
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span>
                <strong className="text-slate-900 dark:text-slate-100">{pendingBackup.alertsCount}</strong> job alerts
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors shadow-2xs ${
                  restoreMode === 'merge'
                    ? 'bg-white dark:bg-[#182030] border-blue-500'
                    : 'bg-white/70 dark:bg-[#131926]/70 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-[#182030]'
                }`}
              >
                <input
                  type="radio"
                  name="restoreMode"
                  checked={restoreMode === 'merge'}
                  onChange={() => {
                    setRestoreMode('merge');
                    setConfirmReplace(false);
                  }}
                  className="mt-0.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Merge with Existing (Recommended)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Adds missing records and preserves everything already tracked.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors shadow-2xs ${
                  restoreMode === 'replace'
                    ? 'bg-white dark:bg-[#182030] border-rose-500'
                    : 'bg-white/70 dark:bg-[#131926]/70 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-[#182030]'
                }`}
              >
                <input
                  type="radio"
                  name="restoreMode"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                  className="mt-0.5 border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Replace All Tracked Data
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Clears current applications, interviews, and alerts before restoring.
                  </div>
                </div>
              </label>
            </div>

            {pendingBackup.hasProfile && (
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeProfile}
                  onChange={(e) => setIncludeProfile(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500"
                />
                Also restore target job titles, keywords, and scan filter settings
              </label>
            )}

            {restoreMode === 'replace' && (
              <label className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-300 cursor-pointer shadow-2xs">
                <input
                  type="checkbox"
                  checked={confirmReplace}
                  onChange={(e) => setConfirmReplace(e.target.checked)}
                  className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                <span>
                  I understand this will permanently overwrite my current applications, interviews, and job alerts (IMAP email credentials remain intact).
                </span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPendingBackup(null);
                  setConfirmReplace(false);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestoreBackup}
                disabled={restoring || (restoreMode === 'replace' && !confirmReplace)}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-2xs transition-colors disabled:opacity-60 ${
                  restoreMode === 'replace'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {restoreMode === 'replace' ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {restoring ? 'Restoring...' : 'Restore Backup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
