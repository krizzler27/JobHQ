import React, { useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Filter,
  Mail,
  Plus,
  RotateCcw,
  Save,
  Sliders,
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
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e5e3dc] dark:border-slate-800">
      <div className="flex items-center gap-2.5">
        <Clock className="w-4 h-4 text-stone-500 dark:text-slate-400 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100">Auto-Sync Schedule</h3>
          <p className="text-xs text-stone-500 dark:text-slate-400">
            Automatically syncs your inbox on a background schedule.
          </p>
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-800 dark:text-slate-200 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChangeEnabled(e.target.checked)}
          className="rounded border-[#e5e3dc] dark:border-slate-600 bg-white dark:bg-slate-800 text-[#234aff] focus:ring-[#234aff]"
        />
        <span>{enabled ? 'Auto-Sync Active' : 'Enable Auto-Sync'}</span>
      </label>
    </div>

    <div className="rounded-xl border border-[#e5e3dc] dark:border-slate-800 bg-[#f9f8f6] dark:bg-[#0e1420]/70 p-4 space-y-3.5">
      <div>
        <div className="text-xs font-semibold text-stone-700 dark:text-slate-300 mb-2">
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
                className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                  active
                    ? 'bg-[#234aff] border-[#234aff] text-white font-semibold shadow-xs'
                    : 'bg-white dark:bg-[#182030] border-[#e5e3dc] dark:border-slate-700 text-stone-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800 font-medium'
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
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
            Cron Expression (min hour day month weekday)
          </label>
          <input
            type="text"
            value={cron}
            onChange={(e) => onChangeCron(e.target.value)}
            placeholder="0 */4 * * *"
            className="w-full rounded-xl border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 font-mono-tabular text-xs text-stone-800 dark:text-slate-200 focus:border-[#234aff] focus:ring-1 focus:ring-[#234aff] focus:outline-none"
          />
          <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-1">
            Runs: <span className="font-semibold text-[#234aff] dark:text-blue-400">{describeCron(cron)}</span>
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
            Lookback Range
          </label>
          <select
            value={lookbackDays}
            onChange={(e) => onChangeLookbackDays(Number(e.target.value))}
            className="w-full rounded-xl border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-xs text-stone-800 dark:text-slate-200 focus:border-[#234aff] focus:ring-1 focus:ring-[#234aff] focus:outline-none"
          >
            <option value={1}>Last 24 hours</option>
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          {enabled && nextRunAt && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-mono-tabular font-medium">
              Next: {new Date(nextRunAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
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
    <div className="rounded-xl border border-[#e5e3dc] dark:border-slate-800 bg-[#f9f8f6] dark:bg-[#0e1420]/70 p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-stone-800 dark:text-slate-200">{label}</div>
          <p className="text-[11px] text-stone-500 dark:text-slate-400">{helper}</p>
        </div>
        <span className="font-mono-tabular text-[11px] text-stone-500 dark:text-slate-400 shrink-0">
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
          className="flex-1 rounded-xl border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-1.5 text-xs text-stone-800 dark:text-slate-200 focus:border-[#234aff] focus:ring-1 focus:ring-[#234aff] focus:outline-none"
        />
        <button
          type="button"
          onClick={addDraftItems}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-xl whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-[11px] text-stone-400 dark:text-slate-500 py-1">No keywords set.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-0.5">
          {items.map((item, idx) => (
            <span
              key={`${item}-${idx}`}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border ${
                tone === 'danger'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                  : 'bg-white dark:bg-[#182030] text-stone-700 dark:text-slate-300 border-[#e5e3dc] dark:border-slate-700'
              }`}
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                aria-label={`Remove ${item}`}
                className="text-stone-400 hover:text-stone-800 dark:hover:text-slate-200 p-0.5 transition-colors"
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

type SettingsTab = 'preferences' | 'email-sync' | 'filters-ai' | 'backup';

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  profile,
  imapStatus,
  onSaveProfile,
  onOpenImapModal,
  onOpenOnboarding,
  onDataRestored,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('preferences');
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

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  const tabs: { id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'preferences', label: 'Job Preferences', icon: Briefcase },
    { id: 'email-sync', label: 'Email & Auto-Sync', icon: Mail },
    { id: 'filters-ai', label: 'Scan Filters & AI', icon: Sliders },
    { id: 'backup', label: 'Backups & Data', icon: Database },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header & Sub-Navigation */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-slate-100 font-display">
              Settings
            </h1>
            <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
              Manage your career criteria, inbox sync automation, filters, and local backups.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {savedNotice && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {savedNotice}
              </span>
            )}
            {activeTab !== 'backup' && (
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving}
                className="btn-cobalt inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-xs disabled:opacity-60 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 border-b border-[#e5e3dc] dark:border-slate-800 pb-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                  active
                    ? 'bg-[#234aff] text-white shadow-xs'
                    : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200 hover:bg-[#eeece6] dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl px-4 py-2.5">
          <span>{saveError}</span>
        </div>
      )}

      {/* TAB 1: Job Preferences */}
      {activeTab === 'preferences' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="studio-card rounded-2xl border border-[#e5e3dc] dark:border-slate-800 p-6 space-y-5">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-stone-900 dark:text-slate-100 font-display">
                Job Preferences & Criteria
              </h2>
              <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                Target criteria used to score job alerts and match incoming applications.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
                  Target Job Titles (comma separated)
                </label>
                <input
                  type="text"
                  value={targetTitles}
                  onChange={(e) => setTargetTitles(e.target.value)}
                  placeholder="Backend Engineer, Python Developer, Tech Lead"
                  className="w-full rounded-xl border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] text-stone-800 dark:text-slate-200 px-3.5 py-2 text-xs focus:border-[#234aff] focus:ring-1 focus:ring-[#234aff] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
                  Skills & Keywords
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Python, SQL, FastAPI, React, Kubernetes"
                  className="w-full rounded-xl border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] text-stone-800 dark:text-slate-200 px-3.5 py-2 text-xs focus:border-[#234aff] focus:ring-1 focus:ring-[#234aff] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
                  Words to Skip / Exclude
                </label>
                <input
                  type="text"
                  value={excluded}
                  onChange={(e) => setExcluded(e.target.value)}
                  placeholder="Intern, Unpaid, Director, Sales"
                  className="w-full rounded-xl border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] text-stone-800 dark:text-slate-200 px-3.5 py-2 text-xs focus:border-[#234aff] focus:ring-1 focus:ring-[#234aff] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
                  Preferred Locations
                </label>
                <input
                  type="text"
                  value={locations}
                  onChange={(e) => setLocations(e.target.value)}
                  placeholder="Remote, Hybrid, New York, San Francisco"
                  className="w-full rounded-xl border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] text-stone-800 dark:text-slate-200 px-3.5 py-2 text-xs focus:border-[#234aff] focus:ring-1 focus:ring-[#234aff] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#e5e3dc] dark:border-slate-800 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="btn-cobalt inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-xs disabled:opacity-60 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: Email & Auto-Sync */}
      {activeTab === 'email-sync' && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Email Connection Card */}
          <div className="studio-card rounded-2xl border border-[#e5e3dc] dark:border-slate-800 p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[#eeece6] dark:bg-slate-800 text-stone-700 dark:text-slate-200 shrink-0">
                <Mail className="w-5 h-5 text-[#234aff]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-stone-900 dark:text-slate-100">Email Connection</h2>
                {imapStatus?.connected ? (
                  <p className="text-xs text-stone-600 dark:text-slate-400 mt-0.5">
                    Connected to <span className="font-semibold text-stone-900 dark:text-slate-100">{imapStatus.email}</span>
                    {' · '}
                    <span className="font-mono-tabular">{imapStatus.host}</span>
                  </p>
                ) : (
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                    Connect Gmail, Outlook, Yahoo, or custom IMAP to sync jobs automatically.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenOnboarding}
                className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-xl whitespace-nowrap transition-colors"
              >
                Quick Setup
              </button>
              <button
                type="button"
                onClick={onOpenImapModal}
                className="btn-cobalt px-3.5 py-1.5 text-xs font-semibold text-white rounded-xl whitespace-nowrap shadow-xs transition-colors"
              >
                {imapStatus?.connected ? 'Change Email' : 'Connect Email'}
              </button>
            </div>
          </div>

          {/* Auto-Sync Schedule Card */}
          <div className="studio-card rounded-2xl border border-[#e5e3dc] dark:border-slate-800 p-6 space-y-4">
            <AutoSyncScheduleEditor
              enabled={autoSyncEnabled}
              cron={autoSyncCron}
              lookbackDays={autoSyncDays}
              nextRunAt={profile?.next_auto_sync_at}
              onChangeEnabled={setAutoSyncEnabled}
              onChangeCron={setAutoSyncCron}
              onChangeLookbackDays={setAutoSyncDays}
            />

            <div className="pt-3 border-t border-[#e5e3dc] dark:border-slate-800 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="btn-cobalt inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-xs disabled:opacity-60 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: Scan Filters & AI */}
      {activeTab === 'filters-ai' && (
        <div className="space-y-6">
          {/* IMAP Scan Filters */}
          <div className="studio-card rounded-2xl border border-[#e5e3dc] dark:border-slate-800 p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#e5e3dc] dark:border-slate-800">
              <div className="flex items-start gap-2.5">
                <Filter className="w-4 h-4 text-stone-500 dark:text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100">Email Scan Filters (IMAP)</h3>
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                    Pre-filters emails directly on your mail server before downloading.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {savingFilters && (
                  <span className="text-xs text-stone-500 dark:text-slate-400">Saving...</span>
                )}
                {!savingFilters && filterNotice && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {filterNotice}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleResetScanFilters}
                  disabled={resettingFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-slate-300 bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-xl whitespace-nowrap shrink-0 disabled:opacity-60 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {resettingFilters ? 'Resetting...' : 'Reset Defaults'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <FilterKeywordEditor
                label="Subject Keywords to Scan"
                helper="Emails whose subject matches any of these words (plus Target Job Titles) are fetched."
                placeholder="Add subject keyword (e.g. assessment, referral, interview)..."
                items={scanSubjectKeywords}
                onChange={(next) => handleScanFilterChange('scan_subject_keywords', next)}
              />

              <FilterKeywordEditor
                label="Sender & Domain Keywords to Scan"
                helper="Senders or job portals searched on the mail server."
                placeholder="Add sender or domain (e.g. greenhouse.io, lever.co)..."
                items={scanSenderKeywords}
                onChange={(next) => handleScanFilterChange('scan_sender_keywords', next)}
              />

              <FilterKeywordEditor
                label="Skip / Noise Words (Always Ignore)"
                helper="Any email containing these sender or subject terms is bypassed immediately."
                placeholder="Add term to skip (e.g. newsletter, receipt, order)..."
                items={scanExcludeKeywords}
                onChange={(next) => handleScanFilterChange('scan_exclude_keywords', next)}
                tone="danger"
              />
            </div>
          </div>

          {/* AI Reader Engine Card */}
          <form onSubmit={handleSave} className="studio-card rounded-2xl border border-[#e5e3dc] dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-start gap-2.5 pb-3 border-b border-[#e5e3dc] dark:border-slate-800">
              <Cpu className="w-4 h-4 text-stone-500 dark:text-slate-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100">Email Parsing Engine</h3>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                  Choose the fast built-in rule parser or a private local AI model.
                </p>
              </div>
            </div>

            <EmailReaderPanel
              llmBackend={llmBackend}
              llmModelPath={llmModelPath}
              onChangeBackend={setLlmBackend}
              onChangeModelPath={setLlmModelPath}
            />

            <div className="pt-3 border-t border-[#e5e3dc] dark:border-slate-800 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="btn-cobalt inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-xs disabled:opacity-60 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save AI Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: Backups & Data */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <BackupRestoreSection onDataRestored={onDataRestored} />
        </div>
      )}
    </div>
  );
};
