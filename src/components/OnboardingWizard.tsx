import React, { useEffect, useState } from 'react';
import { ArrowRight, Clock, Cpu, Filter, Mail, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { api } from '../api';
import type { ImapStatus, LlmBackend, ProfileSettings } from '../types';
import { EmailReaderPanel } from './EmailReaderPanel';
import { ImapConnectionForm } from './ImapModal';
import { AutoSyncScheduleEditor, FilterKeywordEditor } from './ProfileSettingsView';

interface OnboardingWizardProps {
  open: boolean;
  imapStatus: ImapStatus | null;
  profile: ProfileSettings | null;
  onFinish: () => Promise<void>;
  onSkip: () => Promise<void>;
}

const parseList = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  open,
  imapStatus,
  profile,
  onFinish,
  onSkip,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [targetTitles, setTargetTitles] = useState('');
  const [keywords, setKeywords] = useState('');
  const [excluded, setExcluded] = useState('');
  const [llmBackend, setLlmBackend] = useState<LlmBackend>('rules');
  const [llmModelPath, setLlmModelPath] = useState('');
  const [scanSubjectKeywords, setScanSubjectKeywords] = useState<string[]>([]);
  const [scanSenderKeywords, setScanSenderKeywords] = useState<string[]>([]);
  const [scanExcludeKeywords, setScanExcludeKeywords] = useState<string[]>([]);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncCron, setAutoSyncCron] = useState('0 */4 * * *');
  const [autoSyncDays, setAutoSyncDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [resettingFilters, setResettingFilters] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!open || !profile) return;
    setTargetTitles((profile.target_titles || []).join(', '));
    setKeywords((profile.keywords || []).join(', '));
    setExcluded((profile.excluded_keywords || []).join(', '));
    setLlmBackend(profile.llm_backend || 'rules');
    setLlmModelPath(profile.llm_model_path || '');
    setScanSubjectKeywords(
      Array.isArray(profile.scan_subject_keywords) ? profile.scan_subject_keywords : [],
    );
    setScanSenderKeywords(
      Array.isArray(profile.scan_sender_keywords) ? profile.scan_sender_keywords : [],
    );
    setScanExcludeKeywords(
      Array.isArray(profile.scan_exclude_keywords) ? profile.scan_exclude_keywords : [],
    );
    setAutoSyncEnabled(Boolean(profile.auto_sync_enabled));
    setAutoSyncCron(profile.auto_sync_cron || '0 */4 * * *');
    setAutoSyncDays(profile.auto_sync_days || 7);
    setSaveError('');
  }, [open, profile]);

  if (!open) return null;

  const handleSaveRoleStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile({
        target_titles: parseList(targetTitles),
        keywords: parseList(keywords),
        excluded_keywords: parseList(excluded),
      });
      setStep(3);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReaderStep = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        llm_backend: llmBackend,
        llm_model_path: llmModelPath,
      });
      setStep(4);
    } finally {
      setSaving(false);
    }
  };

  const handleResetFilters = async () => {
    setResettingFilters(true);
    try {
      const reset = await api.resetScanFilters();
      setScanSubjectKeywords(reset.scan_subject_keywords || []);
      setScanSenderKeywords(reset.scan_sender_keywords || []);
      setScanExcludeKeywords(reset.scan_exclude_keywords || []);
    } finally {
      setResettingFilters(false);
    }
  };

  const handleSaveFiltersStep = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await api.updateProfile({
        scan_subject_keywords: scanSubjectKeywords,
        scan_sender_keywords: scanSenderKeywords,
        scan_exclude_keywords: scanExcludeKeywords,
      });
      setStep(5);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save scan filters.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await api.updateProfile({
        target_titles: parseList(targetTitles),
        keywords: parseList(keywords),
        excluded_keywords: parseList(excluded),
        llm_backend: llmBackend,
        llm_model_path: llmModelPath,
        scan_subject_keywords: scanSubjectKeywords,
        scan_sender_keywords: scanSenderKeywords,
        scan_exclude_keywords: scanExcludeKeywords,
        auto_sync_enabled: autoSyncEnabled,
        auto_sync_cron: autoSyncCron.trim(),
        auto_sync_days: autoSyncDays,
        onboarding_completed: true,
      });
      await onFinish();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save setup settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131926] shadow-xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Quick Setup
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Set up once and your dashboard will be ready every time you open it.
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-semibold text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 whitespace-nowrap transition-colors"
          >
            Skip for now
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0e1420]/80 text-xs">
          {[
            { id: 1, label: '1. Connect Email', icon: Mail },
            { id: 2, label: '2. Jobs You Want', icon: SlidersHorizontal },
            { id: 3, label: '3. Email Reader', icon: Cpu },
            { id: 4, label: '4. Scan Filters', icon: Filter },
            { id: 5, label: '5. Auto Sync', icon: Clock },
          ].map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSaveError('');
                  setStep(s.id as 1 | 2 | 3 | 4 | 5);
                }}
                className={`flex items-center justify-center gap-1.5 py-3 px-2 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#131926]'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <ImapConnectionForm
                initialStatus={imapStatus}
                submitLabel="Test & Continue"
                onConnected={() => setStep(2)}
              />
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  Your login stays on your computer.
                </span>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Next step
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSaveRoleStep} className="space-y-4">
              <p className="text-xs text-slate-600">
                Add the job titles you are looking for so job alerts from LinkedIn, Indeed, or other apps are ranked for you.
              </p>

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Skills &amp; Keywords
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
                    placeholder="Intern, Sales, PHP"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Save &amp; Continue
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <EmailReaderPanel
                llmBackend={llmBackend}
                llmModelPath={llmModelPath}
                onChangeBackend={setLlmBackend}
                onChangeModelPath={setLlmModelPath}
              />

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveReaderStep}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save & Continue'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs text-slate-600 max-w-lg">
                  Before reading any email, Job Tracker searches headers on your mail server using these keywords. Review or customize them now, or change them later in Settings.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  disabled={resettingFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {resettingFilters ? 'Resetting...' : 'Reset Defaults'}
                </button>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                <FilterKeywordEditor
                  label="Subject Keywords to Scan"
                  helper="Emails whose subject matches these words (plus your Target Job Titles) are fetched from your inbox."
                  placeholder="Add subject keyword (e.g. technical assessment, referral)..."
                  items={scanSubjectKeywords}
                  onChange={setScanSubjectKeywords}
                />

                <FilterKeywordEditor
                  label="Sender & Domain Keywords to Scan"
                  helper="Job platforms and recruiting senders checked on the mail server (e.g. greenhouse, workday, recruit)."
                  placeholder="Add sender or domain (e.g. wellfound.com, talent@)..."
                  items={scanSenderKeywords}
                  onChange={setScanSenderKeywords}
                />

                <FilterKeywordEditor
                  label="Skip / Noise Words (Always Ignore)"
                  helper="Any email whose sender or subject contains these words is always ignored."
                  placeholder="Add word or sender to skip (e.g. newsletter, invoice, substack)..."
                  items={scanExcludeKeywords}
                  onChange={setScanExcludeKeywords}
                  tone="danger"
                />
              </div>

              {saveError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                  {saveError}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveFiltersStep}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save & Continue'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <AutoSyncScheduleEditor
                enabled={autoSyncEnabled}
                cron={autoSyncCron}
                lookbackDays={autoSyncDays}
                nextRunAt={autoSyncEnabled ? profile?.next_auto_sync_at : null}
                onChangeEnabled={setAutoSyncEnabled}
                onChangeCron={setAutoSyncCron}
                onChangeLookbackDays={setAutoSyncDays}
              />

              {saveError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                  {saveError}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSaveError('');
                    setStep(4);
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Finish Setup'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
