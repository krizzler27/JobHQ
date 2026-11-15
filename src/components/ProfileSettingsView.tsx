import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Cpu,
  Filter,
  Mail,
  Plus,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import { api } from '../api';
import type {
  ImapStatus,
  LlmBackend,
  ProfileSettings,
} from '../types';
import { describeCron } from '../utils/appHelpers';
import { EmailReaderPanel } from './EmailReaderPanel';
import { BackupRestoreSection } from './BackupRestoreSection';

interface ProfileSettingsViewProps {
  profile: ProfileSettings | null;
  imapStatus: ImapStatus | null;
  onSaveProfile: (updates: Partial<ProfileSettings>) => Promise<void>;
  onOpenImapModal: () => void;
  onOpenOnboarding: () => void;
  onDataRestored: () => Promise<void>;
}

const parseList = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const CRON_TEMPLATES: { label: string; cron: string; hint: string }[] = [
  { label: 'Every 30 min', cron: '*/30 * * * *', hint: 'Runs twice every hour' },
  { label: 'Every 1 hour', cron: '0 * * * *', hint: 'Top of every hour' },
  { label: 'Every 2 hours', cron: '0 */2 * * *', hint: 'Every 2nd hour' },
  { label: 'Every 4 hours', cron: '0 */4 * * *', hint: 'Every 4th hour' },
  { label: 'Every 6 hours', cron: '0 */6 * * *', hint: 'Four times a day' },
  { label: 'Daily 9 AM', cron: '0 9 * * *', hint: 'Once daily at 09:00' },
  { label: '9 AM & 6 PM', cron: '0 9,18 * * *', hint: 'Morning & evening' },
  { label: 'Weekdays 9–6 (2h)', cron: '0 9-18/2 * * 1-5', hint: 'Mon–Fri work hours' },
];

interface AutoSyncScheduleEditorProps {
  enabled: boolean;
  cron: string;
  lookbackDays: number;
  nextRunAt?: string | null;
  onChangeEnabled: (enabled: boolean) => void;
  onChangeCron: (cron: string) => void;
  onChangeLookbackDays: (days: number) => void;
}

export const AutoSyncScheduleEditor: React.FC<AutoSyncScheduleEditorProps> = ({
  enabled,
  cron,
  lookbackDays,
  nextRunAt,
  onChangeEnabled,
  onChangeCron,
  onChangeLookbackDays,
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <Clock className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Auto-Sync Schedule (Unix Cron)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatically syncs your inbox in the background using standard 5-field cron syntax while the server is running.
          </p>
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChangeEnabled(e.target.checked)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span>{enabled ? 'Auto-Sync Enabled' : 'Enable Auto-Sync'}</span>
      </label>
    </div>

    <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4 space-y-3">
      <div>
        <div className="text-xs font-medium text-slate-700 mb-2">
          Quick Schedule Templates
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CRON_TEMPLATES.map((tpl) => {
            const active = cron.trim() === tpl.cron;
            return (
              <button
                key={tpl.cron}
                type="button"
                title={`${tpl.cron} — ${tpl.hint}`}
                onClick={() => {
                  onChangeCron(tpl.cron);
                  if (!enabled) onChangeEnabled(true);
                }}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  active
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tpl.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Unix Cron Expression (min hour day month weekday)
          </label>
          <input
            type="text"
            value={cron}
            onChange={(e) => onChangeCron(e.target.value)}
            placeholder="0 */4 * * *"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono-tabular text-xs focus:border-blue-600 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Schedule: <span className="font-medium text-blue-700">{describeCron(cron)}</span>
            {' · '}
            <span className="font-mono-tabular">min hr day month weekday</span>
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Auto-Sync Lookback
          </label>
          <select
            value={lookbackDays}
            onChange={(e) => onChangeLookbackDays(Number(e.target.value))}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          {enabled && nextRunAt && (
            <p className="text-[11px] text-emerald-700 mt-1 font-mono-tabular">
              Next run: {new Date(nextRunAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  </div>
);

interface FilterKeywordEditorProps {
  label: string;
  helper: string;
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
  tone?: 'default' | 'danger';
}

export const FilterKeywordEditor: React.FC<FilterKeywordEditorProps> = ({
  label,
  helper,
  placeholder,
  items,
  onChange,
  tone = 'default',
}) => {
  const [draft, setDraft] = useState('');

  const addDraftItems = () => {
    const incoming = parseList(draft);
    if (incoming.length === 0) return;
    const seen = new Set(items.map((x) => x.toLowerCase()));
    const merged = [...items];
    for (const term of incoming) {
      if (!seen.has(term.toLowerCase())) {
        seen.add(term.toLowerCase());
        merged.push(term);
      }
    }
    onChange(merged);
    setDraft('');
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/50 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-800">{label}</div>
          <p className="text-[11px] text-slate-500">{helper}</p>
        </div>
        <span className="font-mono-tabular text-[11px] text-slate-500 shrink-0">
          {items.length} {items.length === 1 ? 'term' : 'terms'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addDraftItems();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={addDraftItems}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-1">No keywords set.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-0.5">
          {items.map((item, idx) => (
            <span
              key={`${item}-${idx}`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border ${
                tone === 'danger'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                aria-label={`Remove ${item}`}
                className="text-slate-400 hover:text-slate-800 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  profile,
  imapStatus,
  onSaveProfile,
  onOpenImapModal,
  onOpenOnboarding,
  onDataRestored,
}) => {
  const [targetTitles, setTargetTitles] = useState('');
  const [keywords, setKeywords] = useState('');
  const [excluded, setExcluded] = useState('');
  const [locations, setLocations] = useState('');
  const [scanSubjectKeywords, setScanSubjectKeywords] = useState<string[]>([]);
  const [scanSenderKeywords, setScanSenderKeywords] = useState<string[]>([]);
  const [scanExcludeKeywords, setScanExcludeKeywords] = useState<string[]>([]);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncCron, setAutoSyncCron] = useState('0 */4 * * *');
  const [autoSyncDays, setAutoSyncDays] = useState(7);
  const [llmBackend, setLlmBackend] = useState<LlmBackend>('rules');
  const [llmModelPath, setLlmModelPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingFilters, setSavingFilters] = useState(false);
  const [resettingFilters, setResettingFilters] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [filterNotice, setFilterNotice] = useState('');
  const [saveError, setSaveError] = useState('');

  const skipFormSyncRef = useRef(false);
  const filterSaveSeqRef = useRef(0);
  const filterNoticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (skipFormSyncRef.current) {
      skipFormSyncRef.current = false;
      return;
    }
    setTargetTitles((profile.target_titles || []).join(', '));
    setKeywords((profile.keywords || []).join(', '));
    setExcluded((profile.excluded_keywords || []).join(', '));
    setLocations((profile.preferred_locations || []).join(', '));
    setScanSubjectKeywords(Array.isArray(profile.scan_subject_keywords) ? profile.scan_subject_keywords : []);
    setScanSenderKeywords(Array.isArray(profile.scan_sender_keywords) ? profile.scan_sender_keywords : []);
    setScanExcludeKeywords(Array.isArray(profile.scan_exclude_keywords) ? profile.scan_exclude_keywords : []);
    setAutoSyncEnabled(Boolean(profile.auto_sync_enabled));
    setAutoSyncCron(profile.auto_sync_cron || '0 */4 * * *');
    setAutoSyncDays(profile.auto_sync_days || 7);
    setLlmBackend(profile.llm_backend || 'rules');
    setLlmModelPath(profile.llm_model_path || '');
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice('');
    setSaveError('');
    try {
      await onSaveProfile({
        target_titles: parseList(targetTitles),
        keywords: parseList(keywords),
        excluded_keywords: parseList(excluded),
        preferred_locations: parseList(locations),
        scan_subject_keywords: scanSubjectKeywords,
        scan_sender_keywords: scanSenderKeywords,
        scan_exclude_keywords: scanExcludeKeywords,
        auto_sync_enabled: autoSyncEnabled,
        auto_sync_cron: autoSyncCron.trim(),
        auto_sync_days: autoSyncDays,
        llm_backend: llmBackend,
        llm_model_path: llmModelPath.trim(),
      });
      setSavedNotice('Settings saved.');
      setTimeout(() => setSavedNotice(''), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleScanFilterChange = async (
    field: 'scan_subject_keywords' | 'scan_sender_keywords' | 'scan_exclude_keywords',
    next: string[],
  ) => {
    if (field === 'scan_subject_keywords') setScanSubjectKeywords(next);
    if (field === 'scan_sender_keywords') setScanSenderKeywords(next);
    if (field === 'scan_exclude_keywords') setScanExcludeKeywords(next);

    const seq = ++filterSaveSeqRef.current;
    setSavingFilters(true);
    setFilterNotice('');
    setSaveError('');
    skipFormSyncRef.current = true;
    try {
      await onSaveProfile({ [field]: next });
      if (seq === filterSaveSeqRef.current) {
        setFilterNotice('Saved');
        if (filterNoticeTimerRef.current) {
          window.clearTimeout(filterNoticeTimerRef.current);
        }
        filterNoticeTimerRef.current = window.setTimeout(() => setFilterNotice(''), 2500);
      }
    } catch (err) {
      skipFormSyncRef.current = false;
      setSaveError(err instanceof Error ? err.message : 'Could not save email scan filters.');
    } finally {
      if (seq === filterSaveSeqRef.current) {
        setSavingFilters(false);
      }
    }
  };

  const handleResetScanFilters = async () => {
    setResettingFilters(true);
    setSavedNotice('');
    setFilterNotice('');
    setSaveError('');
    skipFormSyncRef.current = true;
    try {
      const reset = await api.resetScanFilters();
      setScanSubjectKeywords(reset.scan_subject_keywords || []);
      setScanSenderKeywords(reset.scan_sender_keywords || []);
      setScanExcludeKeywords(reset.scan_exclude_keywords || []);
      await onSaveProfile({
        scan_subject_keywords: reset.scan_subject_keywords || [],
        scan_sender_keywords: reset.scan_sender_keywords || [],
        scan_exclude_keywords: reset.scan_exclude_keywords || [],
      });
      setFilterNotice('Reset to defaults');
      if (filterNoticeTimerRef.current) {
        window.clearTimeout(filterNoticeTimerRef.current);
      }
      filterNoticeTimerRef.current = window.setTimeout(() => setFilterNotice(''), 3000);
    } catch (err) {
      skipFormSyncRef.current = false;
      setSaveError(err instanceof Error ? err.message : 'Could not reset email scan filters.');
    } finally {
      setResettingFilters(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Email Connection Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Mail className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Email Connection</h2>
            {imapStatus?.connected ? (
              <p className="text-xs text-slate-600 mt-0.5">
                Connected to <span className="font-medium text-slate-900">{imapStatus.email}</span>
                {' · '}
                <span className="font-mono-tabular">{imapStatus.host}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">
                Connect Gmail, Outlook, Yahoo, or another email inbox to sync job updates automatically.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenOnboarding}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            Quick Setup
          </button>
          <button
            type="button"
            onClick={onOpenImapModal}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md whitespace-nowrap"
          >
            {imapStatus?.connected ? 'Change Email' : 'Connect Email'}
          </button>
        </div>
      </div>

      {/* Jobs You Want + How Emails Are Read */}
      <form
        onSubmit={handleSave}
        className="rounded-lg border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Jobs You Want</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Used to rank job alert emails based on your goals and past applications.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {savedNotice && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {saveError && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
            <span>{saveError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Target Job Titles (separated by commas)
            </label>
            <input
              type="text"
              value={targetTitles}
              onChange={(e) => setTargetTitles(e.target.value)}
              placeholder="Backend Engineer, Python Developer, Full Stack Engineer"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Skills & Keywords
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Python, SQL, FastAPI, React"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Words to Skip
            </label>
            <input
              type="text"
              value={excluded}
              onChange={(e) => setExcluded(e.target.value)}
              placeholder="Intern, Director, Sales, PHP"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Preferred Locations
            </label>
            <input
              type="text"
              value={locations}
              onChange={(e) => setLocations(e.target.value)}
              placeholder="Remote, San Francisco, Bengaluru"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <AutoSyncScheduleEditor
            enabled={autoSyncEnabled}
            cron={autoSyncCron}
            lookbackDays={autoSyncDays}
            nextRunAt={profile?.next_auto_sync_at}
            onChangeEnabled={setAutoSyncEnabled}
            onChangeCron={setAutoSyncCron}
            onChangeLookbackDays={setAutoSyncDays}
          />
        </div>

        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Filter className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Email Scan Filters (IMAP)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filters emails directly on your mail server (IMAP) before fetching content. Changes save automatically when you add or remove a keyword.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {savingFilters && (
                <span className="text-xs text-slate-500">Saving...</span>
              )}
              {!savingFilters && filterNotice && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {filterNotice}
                </span>
              )}
              <button
                type="button"
                onClick={handleResetScanFilters}
                disabled={resettingFilters}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {resettingFilters ? 'Resetting...' : 'Reset Defaults'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <FilterKeywordEditor
              label="Subject Keywords to Scan"
              helper="Emails whose subject matches any of these words (plus your Target Job Titles) are searched on the mail server."
              placeholder="Add subject keyword (e.g. technical assessment, referral)..."
              items={scanSubjectKeywords}
              onChange={(next) => handleScanFilterChange('scan_subject_keywords', next)}
            />

            <FilterKeywordEditor
              label="Sender & Domain Keywords to Scan"
              helper="Senders or job platforms searched on the mail server (e.g. greenhouse, workday, recruit)."
              placeholder="Add sender or domain (e.g. wellfound.com, talent@)..."
              items={scanSenderKeywords}
              onChange={(next) => handleScanFilterChange('scan_sender_keywords', next)}
            />

            <FilterKeywordEditor
              label="Skip / Noise Words (Always Ignore)"
              helper="Any email whose sender or subject contains these words is always skipped."
              placeholder="Add word or sender to skip (e.g. newsletter, invoice, substack)..."
              items={scanExcludeKeywords}
              onChange={(next) => handleScanFilterChange('scan_exclude_keywords', next)}
              tone="danger"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-start gap-2.5">
            <Cpu className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">How Emails Are Read</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose the fast built-in reader or download an optional local AI model that stays private on your computer.
              </p>
            </div>
          </div>

          <EmailReaderPanel
            llmBackend={llmBackend}
            llmModelPath={llmModelPath}
            onChangeBackend={setLlmBackend}
            onChangeModelPath={setLlmModelPath}
          />
        </div>

        <div className="bg-slate-50 border-t border-slate-200 -mx-6 -mb-6 px-6 py-4 rounded-b-lg flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Save profile goals, auto-sync schedule, and email reader settings.
          </span>
          <div className="flex items-center gap-3 shrink-0">
            {savedNotice && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {savedNotice}
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>

      {/* Data Backup & Restore Card */}
      <BackupRestoreSection onDataRestored={onDataRestored} />
    </div>
  );
};
