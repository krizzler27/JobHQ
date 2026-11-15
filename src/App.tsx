import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Columns3,
  Download,
  ListFilter,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import { api, APPLICATION_STAGES } from './api';
import type { AlertConvertPayload } from './api';
import {
  describeCron,
  downloadCsv,
  formatLocalDateTime,
  formatLocalDateTimeTooltip,
  isStaleApplication,
} from './utils/appHelpers';
import { AddApplicationModal, AddInterviewModal } from './components/AddModals';
import { ApplicationDrawer } from './components/ApplicationDrawer';
import { ApplicationsTableView } from './components/ApplicationsTableView';
import { AppHeader, AppSidebar, NAV_ITEMS } from './components/AppNavigation';
import type { NavTab } from './components/AppNavigation';
import { BatchDeleteKeywordModal } from './components/BatchDeleteKeywordModal';
import type { BatchDeleteCandidateItem } from './components/BatchDeleteKeywordModal';
import { CalendarView } from './components/CalendarView';
import { DuplicateGuardModal } from './components/DuplicateGuardModal';
import type { DuplicateGuardCandidate } from './components/DuplicateGuardModal';
import { EmailFilterModal } from './components/EmailFilterModal';
import type { EmailFilterTarget } from './components/EmailFilterModal';
import { ImapModal } from './components/ImapModal';
import { InterviewsView } from './components/InterviewsView';
import { JobAlertsView } from './components/JobAlertsView';
import { KanbanBoard } from './components/KanbanBoard';
import { MoveAlertModal } from './components/MoveAlertModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { OverviewView } from './components/OverviewView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { ScanLogView } from './components/ScanLogView';
import { StatsView } from './components/StatsView';
import type {
  Application,
  ApplicationStatus,
  DashboardSummary,
  DuplicateMatch,
  Interview,
  InterviewStatus,
  JobAlert,
  JobAlertStatus,
  ProfileSettings,
  StatsSummary,
  SyncJobStatus,
} from './types';

const STAGE_TONE: Record<ApplicationStatus, string> = {
  applied: 'text-slate-700',
  interviewing: 'text-blue-700',
  offer: 'text-emerald-700',
  rejected: 'text-rose-700',
  ghosted: 'text-amber-700',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [appViewMode, setAppViewMode] = useState<'kanban' | 'table'>('kanban');
  const [appStatusFilter, setAppStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [appStaleOnly, setAppStaleOnly] = useState(false);
  const [appSearch, setAppSearch] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('job_tracker_sidebar_open');
      if (saved !== null) return saved === 'true';
    } catch {
      // Ignore storage failures
    }
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  });
  const [overviewPaceMode, setOverviewPaceMode] = useState<'daily' | 'weekly'>('weekly');

  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [overviewStats, setOverviewStats] = useState<StatsSummary | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [profile, setProfile] = useState<ProfileSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [syncJob, setSyncJob] = useState<SyncJobStatus | null>(null);
  const [scanRefreshKey, setScanRefreshKey] = useState(0);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [syncDays, setSyncDays] = useState(30);
  const [banner, setBanner] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showAddApp, setShowAddApp] = useState(false);
  const [showAddInterview, setShowAddInterview] = useState(false);
  const [showImapModal, setShowImapModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [moveAlertState, setMoveAlertState] = useState<{
    alert: JobAlert;
    target: 'application' | 'interview';
  } | null>(null);
  const [duplicateGuard, setDuplicateGuard] = useState<
    | {
        kind: 'manual';
        candidate: DuplicateGuardCandidate;
        payload: Partial<Application>;
        matches: DuplicateMatch[];
      }
    | {
        kind: 'alert_apply';
        candidate: DuplicateGuardCandidate;
        alert: JobAlert;
        matches: DuplicateMatch[];
      }
    | {
        kind: 'alert_convert';
        candidate: DuplicateGuardCandidate;
        alertId: number;
        payload: AlertConvertPayload;
        matches: DuplicateMatch[];
      }
    | null
  >(null);
  const [batchDeleteState, setBatchDeleteState] = useState<{
    kind: 'application' | 'interview' | 'alert';
    filteredIds: number[];
    hasActiveFilter: boolean;
  } | null>(null);
  const [emailFilterTarget, setEmailFilterTarget] = useState<EmailFilterTarget | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  const syncing = syncJob?.status === 'running';

  const loadAllData = useCallback(async () => {
    try {
      const [dashRes, statsRes, ivRes, alertRes, profRes] = await Promise.all([
        api.getDashboard(),
        api.getStats('all'),
        api.listInterviews('all'),
        api.listAlerts({ status: 'all' }),
        api.getProfile(),
      ]);
      setDashboard(dashRes);
      setOverviewStats(statsRes);
      setInterviews(ivRes.interviews);
      setAlerts(alertRes.alerts);
      setProfile(profRes);
      setStatsRefreshKey((k) => k + 1);

      if (!onboardingChecked) {
        setOnboardingChecked(true);
        if (!profRes.onboarding_completed && !dashRes.imap.connected) {
          setShowOnboarding(true);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workspace data.';
      setBanner({ type: 'error', text: message });
    } finally {
      setLoading(false);
    }
  }, [onboardingChecked]);

  useEffect(() => {
    loadAllData();
    api
      .getSyncStatus()
      .then((job) => {
        if (job.status === 'running') {
          setSyncJob(job);
        }
      })
      .catch(() => {});
  }, [loadAllData]);

  const lastMidSyncSignatureRef = useRef('');
  const lastMidSyncRefreshAtRef = useRef(0);
  const midSyncRefreshInFlightRef = useRef(false);

  useEffect(() => {
    if (syncJob?.status !== 'running') {
      lastMidSyncSignatureRef.current = '';
      lastMidSyncRefreshAtRef.current = 0;
      midSyncRefreshInFlightRef.current = false;
      return;
    }

    const timer = setInterval(async () => {
      try {
        const next = await api.getSyncStatus();
        setSyncJob(next);

        if (next.status === 'running') {
          const s = next.stats;
          const sig = `${s.applications_added}-${s.applications_updated}-${s.interviews_added}-${s.alerts_added}-${s.processed_new}`;
          const nowMs = Date.now();
          const hasIngestedChanges =
            s.applications_added +
              s.applications_updated +
              s.interviews_added +
              s.alerts_added +
              s.processed_new >
            0;
          if (
            hasIngestedChanges &&
            sig !== lastMidSyncSignatureRef.current &&
            !midSyncRefreshInFlightRef.current &&
            nowMs - lastMidSyncRefreshAtRef.current >= 1500
          ) {
            lastMidSyncSignatureRef.current = sig;
            lastMidSyncRefreshAtRef.current = nowMs;
            midSyncRefreshInFlightRef.current = true;
            setScanRefreshKey((k) => k + 1);
            loadAllData().finally(() => {
              midSyncRefreshInFlightRef.current = false;
            });
          }
          return;
        }

        clearInterval(timer);
        await loadAllData();
        setScanRefreshKey((k) => k + 1);
        const s = next.stats;
        if (next.status === 'completed') {
          const parts = [
            `Checked ${s.fetched} headers (${s.filtered_out ?? 0} non-job filtered, ${s.skipped_existing} already seen)`,
            `Read ${s.processed_new} new${s.ai_parsed ? ` (${s.ai_parsed} via AI)` : ''}`,
            `${s.applications_added + s.applications_updated} job updates`,
            `${s.interviews_added} interviews`,
            `${s.alerts_added} job alerts`,
          ];
          if (s.model_unloaded) parts.push('AI model unloaded from RAM');
          if (s.llm_fallback_note) parts.push(s.llm_fallback_note);
          setBanner({ type: 'info', text: parts.join(' · ') });
        } else if (next.status === 'cancelled') {
          const extra =
            s.processed_new > 0 ? ` Saved ${s.processed_new} scanned email(s) before stopping.` : '';
          setBanner({
            type: 'info',
            text: `${next.error || 'Sync cancelled.'}${extra}${s.model_unloaded ? ' · AI model unloaded from RAM' : ''}`,
          });
        } else if (next.status === 'error') {
          setBanner({
            type: 'error',
            text: next.error || 'Email sync failed. Check terminal logs for details.',
          });
        }
      } catch (err) {
        clearInterval(timer);
        setSyncJob(null);
        setBanner({
          type: 'error',
          text: err instanceof Error ? err.message : 'Lost connection while checking sync status.',
        });
      }
    }, 650);
    return () => clearInterval(timer);
  }, [syncJob?.status, loadAllData]);

  // Detect background auto-sync runs triggered by the Python scheduler
  useEffect(() => {
    if (!profile?.auto_sync_enabled || syncJob?.status === 'running') return;
    const timer = setInterval(async () => {
      try {
        const job = await api.getSyncStatus();
        if (job.status === 'running') {
          setSyncJob(job);
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [profile?.auto_sync_enabled, syncJob?.status]);

  const handleSyncInbox = async (forceRescan = false) => {
    if (!dashboard?.imap.connected) {
      setShowImapModal(true);
      return;
    }

    setBanner(null);
    try {
      const started = await api.syncImap(syncDays, forceRescan);
      setSyncJob(started);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start inbox sync.';
      setBanner({ type: 'error', text: message });
    }
  };

  const handleCancelSync = async () => {
    try {
      const updated = await api.cancelSync();
      setSyncJob(updated);
    } catch {
      // Polling will settle state cleanly
    }
  };

  const handleMoveStage = async (appId: number, status: ApplicationStatus) => {
    setDashboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        applications: prev.applications.map((a) =>
          a.id === appId ? { ...a, status } : a,
        ),
      };
    });
    await api.updateApplication(appId, { status });
    await loadAllData();
  };

  const handleSaveApp = async (appId: number, updates: Partial<Application>) => {
    await api.updateApplication(appId, updates);
    await loadAllData();
  };

  const handleDeleteApp = async (appId: number) => {
    await api.deleteApplication(appId);
    await loadAllData();
  };

  const handleBulkMoveApps = async (ids: number[], status: ApplicationStatus) => {
    const res = await api.bulkApplications({ ids, action: 'move_stage', status });
    await loadAllData();
    setBanner({
      type: 'info',
      text: `Moved ${res.updated} application${res.updated === 1 ? '' : 's'} to ${status}.`,
    });
  };

  const handleBulkDeleteApps = async (ids: number[]) => {
    const res = await api.bulkApplications({ ids, action: 'delete' });
    await loadAllData();
    setBanner({
      type: 'info',
      text: `Deleted ${res.deleted} application${res.deleted === 1 ? '' : 's'}.`,
    });
  };

  const handleCreateApp = async (payload: Partial<Application>): Promise<boolean> => {
    const dupCheck = await api.checkDuplicateApplication({
      company: payload.company || '',
      role_title: payload.role_title || '',
      job_url: payload.job_url || '',
    });
    if (dupCheck.has_duplicates && dupCheck.matches.length > 0) {
      setDuplicateGuard({
        kind: 'manual',
        candidate: {
          company: payload.company || 'Unknown Company',
          role_title: payload.role_title || 'Untitled Role',
          source_platform: payload.source_platform || 'Manual',
          job_url: payload.job_url,
        },
        payload,
        matches: dupCheck.matches,
      });
      return false;
    }
    await api.createApplication(payload);
    await loadAllData();
    return true;
  };

  const handleCreateInterview = async (payload: Partial<Interview>) => {
    await api.createInterview(payload);
    await loadAllData();
  };

  const handleUpdateInterviewStatus = async (id: number, status: InterviewStatus) => {
    await api.updateInterview(id, { status });
    await loadAllData();
  };

  const handleDeleteInterview = async (id: number) => {
    await api.deleteInterview(id);
    await loadAllData();
  };

  const handleBulkDeleteInterviews = async (ids: number[]) => {
    const res = await api.bulkInterviews({ ids, action: 'delete' });
    await loadAllData();
    setBanner({
      type: 'info',
      text: `Deleted ${res.deleted} interview${res.deleted === 1 ? '' : 's'}.`,
    });
  };

  const handleUpdateAlertStatus = async (id: number, status: JobAlertStatus) => {
    if (status === 'applied') {
      const targetAlert =
        alerts.find((a) => a.id === id) ||
        dashboard?.suggested_alerts.find((a) => a.id === id);
      if (targetAlert && targetAlert.status !== 'applied') {
        const company = targetAlert.company_name?.trim() || `Via ${targetAlert.source_app}`;
        const dupCheck = await api.checkDuplicateApplication({
          company,
          role_title: targetAlert.job_title,
          job_url: targetAlert.job_url || '',
        });
        if (dupCheck.has_duplicates && dupCheck.matches.length > 0) {
          setDuplicateGuard({
            kind: 'alert_apply',
            candidate: {
              company,
              role_title: targetAlert.job_title,
              source_platform: targetAlert.source_app,
              job_url: targetAlert.job_url,
            },
            alert: targetAlert,
            matches: dupCheck.matches,
          });
          return;
        }
      }
    }

    const res = await api.updateAlertStatus(id, status);
    await loadAllData();
    if (status === 'applied' && res.created_application) {
      setBanner({
        type: 'info',
        text: `Added "${res.created_application.role_title}" (${res.created_application.source_platform}) to Applied.`,
      });
    }
  };

  const handleDeleteAlert = async (id: number) => {
    await api.deleteAlert(id);
    await loadAllData();
    setBanner({ type: 'info', text: 'Deleted job alert.' });
  };

  const handleBulkAlertAction = async (
    ids: number[],
    action: 'dismiss' | 'apply' | 'restore' | 'delete',
  ) => {
    const res = await api.bulkAlerts({ ids, action });
    await loadAllData();
    if (action === 'apply') {
      setBanner({
        type: 'info',
        text: `Marked ${res.updated} alert${res.updated === 1 ? '' : 's'} applied (${res.created_applications} added to Applied).`,
      });
    } else if (action === 'dismiss') {
      setBanner({
        type: 'info',
        text: `Dismissed ${res.updated} alert${res.updated === 1 ? '' : 's'}.`,
      });
    } else if (action === 'delete') {
      const count = res.deleted ?? 0;
      setBanner({
        type: 'info',
        text: `Deleted ${count} job alert${count === 1 ? '' : 's'}.`,
      });
    } else {
      setBanner({
        type: 'info',
        text: `Restored ${res.updated} alert${res.updated === 1 ? '' : 's'} to Suggested.`,
      });
    }
  };

  const handleConvertAlert = async (
    alertId: number,
    payload: AlertConvertPayload,
  ): Promise<boolean> => {
    if (payload.target === 'application' && !payload.resolve_duplicate) {
      const dupCheck = await api.checkDuplicateApplication({
        company: payload.company || '',
        role_title: payload.role_title || '',
        job_url: payload.job_url || '',
      });
      if (dupCheck.has_duplicates && dupCheck.matches.length > 0) {
        setDuplicateGuard({
          kind: 'alert_convert',
          candidate: {
            company: payload.company || 'Unknown Company',
            role_title: payload.role_title || 'Untitled Role',
            source_platform: payload.source_platform,
            job_url: payload.job_url,
          },
          alertId,
          payload,
          matches: dupCheck.matches,
        });
        return false;
      }
    }

    const res = await api.convertAlert(alertId, payload);
    await loadAllData();
    if (res.target === 'interview') {
      setBanner({
        type: 'info',
        text: `Moved "${res.application.role_title}" at ${res.application.company} to Upcoming Interviews.`,
      });
    } else {
      setBanner({
        type: 'info',
        text: `Moved "${res.application.role_title}" at ${res.application.company} to Applications.`,
      });
    }
    return true;
  };

  const handleResolveDuplicateUpdate = async (existingId: number) => {
    if (!duplicateGuard) return;
    const guard = duplicateGuard;
    if (guard.kind === 'manual') {
      const updated = await api.updateApplication(existingId, {
        ...guard.payload,
        last_update_date: guard.payload.applied_date || new Date().toISOString().slice(0, 10),
        merge: true,
      });
      setDuplicateGuard(null);
      setShowAddApp(false);
      await loadAllData();
      setBanner({
        type: 'info',
        text: `Updated existing application "${updated.role_title}" at ${updated.company}.`,
      });
    } else if (guard.kind === 'alert_apply') {
      const res = await api.updateAlertStatus(guard.alert.id, 'applied', {
        resolve_duplicate: 'update_existing',
        existing_app_id: existingId,
      });
      setDuplicateGuard(null);
      await loadAllData();
      const targetApp = res.updated_application || res.created_application;
      setBanner({
        type: 'info',
        text: targetApp
          ? `Updated existing application "${targetApp.role_title}" at ${targetApp.company} and marked alert applied.`
          : 'Updated existing application and marked alert applied.',
      });
    } else if (guard.kind === 'alert_convert') {
      const res = await api.convertAlert(guard.alertId, {
        ...guard.payload,
        resolve_duplicate: 'update_existing',
        existing_app_id: existingId,
      });
      setDuplicateGuard(null);
      setMoveAlertState(null);
      await loadAllData();
      setBanner({
        type: 'info',
        text: `Updated existing application "${res.application.role_title}" at ${res.application.company}.`,
      });
    }
  };

  const handleResolveDuplicateAddAnyway = async () => {
    if (!duplicateGuard) return;
    const guard = duplicateGuard;
    if (guard.kind === 'manual') {
      const created = await api.createApplication(guard.payload);
      setDuplicateGuard(null);
      setShowAddApp(false);
      await loadAllData();
      setBanner({
        type: 'info',
        text: `Added "${created.role_title}" at ${created.company} as a separate application.`,
      });
    } else if (guard.kind === 'alert_apply') {
      const res = await api.updateAlertStatus(guard.alert.id, 'applied', {
        resolve_duplicate: 'add_anyway',
      });
      setDuplicateGuard(null);
      await loadAllData();
      if (res.created_application) {
        setBanner({
          type: 'info',
          text: `Added "${res.created_application.role_title}" (${res.created_application.source_platform}) as a separate application.`,
        });
      }
    } else if (guard.kind === 'alert_convert') {
      const res = await api.convertAlert(guard.alertId, {
        ...guard.payload,
        resolve_duplicate: 'add_anyway',
      });
      setDuplicateGuard(null);
      setMoveAlertState(null);
      await loadAllData();
      setBanner({
        type: 'info',
        text: `Moved "${res.application.role_title}" at ${res.application.company} as a separate application.`,
      });
    }
  };

  const handleDismissBelowScore = async (minScore = 40) => {
    const res = await api.bulkAlerts({
      action: 'dismiss_below_score',
      min_score: minScore,
    });
    await loadAllData();
    setBanner({
      type: 'info',
      text: `Dismissed ${res.updated} alert${res.updated === 1 ? '' : 's'} below ${minScore}% match.`,
    });
  };

  const handleRescoreAlerts = async () => {
    await api.rescoreAlerts();
    await loadAllData();
  };

  const handleSaveProfile = async (updates: Partial<ProfileSettings>) => {
    const saved = await api.updateProfile(updates);
    setProfile(saved);
    await loadAllData();
  };

  const handleDisconnectImap = async () => {
    await api.disconnectImap();
    await loadAllData();
    setBanner({ type: 'info', text: 'Disconnected saved IMAP mailbox.' });
  };

  const applications = dashboard?.applications || [];
  const staleAppCount = useMemo(
    () => applications.filter((app) => isStaleApplication(app)).length,
    [applications],
  );

  const filteredApps = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    return applications.filter((app) => {
      if (appViewMode === 'table' && appStatusFilter !== 'all' && app.status !== appStatusFilter) {
        return false;
      }
      if (appStaleOnly && !isStaleApplication(app)) {
        return false;
      }
      if (q) {
        const hay = `${app.company} ${app.role_title} ${app.source_platform} ${app.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [applications, appViewMode, appStatusFilter, appStaleOnly, appSearch]);

  const handleExportAppsCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `applications-${stamp}.csv`,
      [
        'Company',
        'Role Title',
        'Status',
        'Source Platform',
        'Location',
        'Applied Date',
        'Last Update',
        'Job Link',
        'Notes',
      ],
      filteredApps.map((app) => [
        app.company,
        app.role_title,
        app.status,
        app.source_platform,
        app.location,
        app.applied_date,
        app.last_update_date,
        app.job_url,
        app.notes,
      ]),
    );
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('job_tracker_sidebar_open', String(next));
      } catch {
        // Ignore storage failures
      }
      return next;
    });
  };

  const activeNavTitle = NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Overview';
  const imap = dashboard?.imap;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <AppSidebar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        relevantAlertsCount={dashboard?.kpis.relevant_alerts || 0}
        upcomingInterviewsCount={dashboard?.kpis.upcoming_interviews || 0}
        imap={imap}
        onOpenImapModal={() => setShowImapModal(true)}
      />

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          activeNavTitle={activeNavTitle}
          lastSyncAt={dashboard?.last_sync_at}
          autoSyncEnabled={profile?.auto_sync_enabled}
          autoSyncCron={profile?.auto_sync_cron}
          nextAutoSyncAt={profile?.next_auto_sync_at}
          syncDays={syncDays}
          onChangeSyncDays={setSyncDays}
          onOpenAddApp={() => setShowAddApp(true)}
          imapConnected={Boolean(imap?.connected)}
          syncing={syncing}
          onSyncInbox={() => handleSyncInbox(false)}
          onOpenImapModal={() => setShowImapModal(true)}
        />

        <main className="flex-1 p-6 space-y-6 max-w-[1440px] w-full mx-auto">
          {syncing && syncJob && (
            <div className="rounded-lg border border-blue-200 bg-white p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                  <span className="text-xs font-semibold text-slate-900">
                    {syncJob.phase === 'connecting' && 'Connecting to your email server...'}
                    {syncJob.phase === 'checking_headers' &&
                      'Checking email headers for job keywords...'}
                    {syncJob.phase === 'downloading' &&
                      `Downloading matching job emails (${syncJob.current}/${syncJob.total})...`}
                    {syncJob.phase === 'reading' &&
                      `Reading matching emails (${syncJob.current}/${syncJob.total})...`}
                    {syncJob.phase === 'unloading' &&
                      'Unloading Local AI model from memory...'}
                    {syncJob.phase === 'cancelling' && 'Stopping sync safely...'}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {syncJob.total > 0 && (
                    <span className="font-mono-tabular text-xs font-medium text-slate-700">
                      {syncJob.current} / {syncJob.total}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelSync}
                    disabled={syncJob.phase === 'cancelling'}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    {syncJob.phase === 'cancelling' ? 'Stopping...' : 'Cancel'}
                  </button>
                </div>
              </div>

              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full bg-blue-600 transition-all duration-300 ${
                    syncJob.total === 0 ? 'w-1/3 animate-pulse' : ''
                  }`}
                  style={
                    syncJob.total > 0
                      ? {
                          width: `${Math.max(
                            6,
                            Math.min(100, Math.round((syncJob.current / syncJob.total) * 100)),
                          )}%`,
                        }
                      : undefined
                  }
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span className="truncate max-w-xl">
                  {syncJob.current_subject
                    ? `Current: ${syncJob.current_subject}`
                    : 'Filtering recent emails by job keywords...'}
                </span>
                <span className="font-mono-tabular whitespace-nowrap">
                  {syncJob.total_headers} headers · {syncJob.filtered_out} non-job filtered ·{' '}
                  {syncJob.stats.applications_added + syncJob.stats.applications_updated} updates ·{' '}
                  {syncJob.stats.interviews_added} interviews · {syncJob.stats.alerts_added} alerts
                </span>
              </div>
            </div>
          )}

          {banner && (
            <div
              className={`flex items-center justify-between gap-3 rounded-md border px-4 py-2.5 text-xs ${
                banner.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <span>{banner.text}</span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="text-xs font-medium underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-lg border border-slate-200 bg-white animate-pulse"
                  />
                ))}
              </div>
              <div className="h-72 rounded-lg border border-slate-200 bg-white animate-pulse" />
            </div>
          ) : activeTab === 'overview' ? (
            <OverviewView
              dashboard={dashboard}
              overviewStats={overviewStats}
              applications={applications}
              imapConnected={Boolean(imap?.connected)}
              overviewPaceMode={overviewPaceMode}
              onChangePaceMode={setOverviewPaceMode}
              onOpenBoard={() => {
                setAppViewMode('kanban');
                setAppStatusFilter('all');
                setAppStaleOnly(false);
                setAppSearch('');
                setActiveTab('applications');
              }}
              onSelectStage={(stage) => {
                setAppStaleOnly(false);
                setAppViewMode('table');
                setAppStatusFilter(stage);
                setAppSearch('');
                setActiveTab('applications');
              }}
              onSyncInbox={() => handleSyncInbox(false)}
              onOpenOnboarding={() => setShowOnboarding(true)}
              onOpenAddApp={() => setShowAddApp(true)}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onUpdateAlertStatus={handleUpdateAlertStatus}
            />
          ) : activeTab === 'stats' ? (
            <StatsView
              refreshTrigger={statsRefreshKey}
              imapConnected={Boolean(imap?.connected)}
              onAddApplication={() => setShowAddApp(true)}
              onSyncInbox={() => handleSyncInbox(false)}
              onJumpToApplications={({ status, search }) => {
                setAppStaleOnly(false);
                if (status) {
                  setAppViewMode('table');
                  setAppStatusFilter(status);
                  setAppSearch('');
                } else {
                  setAppViewMode('table');
                  setAppStatusFilter('all');
                  setAppSearch(search || '');
                }
                setActiveTab('applications');
              }}
            />
          ) : activeTab === 'applications' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={appSearch}
                      onChange={(e) => setAppSearch(e.target.value)}
                      placeholder="Search company, role, source..."
                      className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md w-60 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  {appViewMode === 'table' && (
                    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setAppStatusFilter('all')}
                        className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
                          appStatusFilter === 'all'
                            ? 'bg-white text-slate-900 border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All
                      </button>
                      {APPLICATION_STAGES.map((st) => (
                        <button
                          key={st.key}
                          type="button"
                          onClick={() => setAppStatusFilter(st.key)}
                          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
                            appStatusFilter === st.key
                              ? 'bg-white text-slate-900 border border-slate-200'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setAppStaleOnly((v) => !v)}
                    title="Show applications unchanged for 10+ days (auto-moved to Ghosted)"
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap ${
                      appStaleOnly
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Follow-up 10d+ ({staleAppCount})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {applications.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setBatchDeleteState({
                          kind: 'application',
                          filteredIds: filteredApps.map((a) => a.id),
                          hasActiveFilter: Boolean(
                            appSearch.trim() ||
                              appStaleOnly ||
                              (appViewMode === 'table' && appStatusFilter !== 'all'),
                          ),
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 rounded-md whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Batch Delete
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleExportAppsCsv}
                    disabled={filteredApps.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>

                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setAppViewMode('kanban')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded whitespace-nowrap ${
                        appViewMode === 'kanban'
                          ? 'bg-white text-slate-900 border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Columns3 className="w-3.5 h-3.5" />
                      Kanban
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppViewMode('table')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded whitespace-nowrap ${
                        appViewMode === 'table'
                          ? 'bg-white text-slate-900 border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Table2 className="w-3.5 h-3.5" />
                      Table
                    </button>
                  </div>
                </div>
              </div>

              {filteredApps.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
                  <ListFilter className="w-6 h-6 text-slate-400 mx-auto mb-2.5" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    No matching applications
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Adjust your search/filter or add a new application.
                  </p>
                </div>
              ) : appViewMode === 'kanban' ? (
                <KanbanBoard
                  applications={filteredApps}
                  onMoveStage={handleMoveStage}
                  onSelectApplication={setSelectedApp}
                />
              ) : (
                <ApplicationsTableView
                  applications={filteredApps}
                  stageTone={STAGE_TONE}
                  onMoveStage={handleMoveStage}
                  onBulkMoveStage={handleBulkMoveApps}
                  onBulkDelete={handleBulkDeleteApps}
                  onSelectApplication={setSelectedApp}
                />
              )}
            </div>
          ) : activeTab === 'calendar' ? (
            <CalendarView
              applications={applications}
              interviews={interviews}
              onSelectApplication={setSelectedApp}
              onUpdateInterviewStatus={handleUpdateInterviewStatus}
              onDeleteInterview={handleDeleteInterview}
              onAddInterview={() => setShowAddInterview(true)}
              onAddApplication={() => setShowAddApp(true)}
            />
          ) : activeTab === 'interviews' ? (
            <InterviewsView
              interviews={interviews}
              onAddInterview={() => setShowAddInterview(true)}
              onUpdateStatus={handleUpdateInterviewStatus}
              onDelete={handleDeleteInterview}
              onBulkDelete={handleBulkDeleteInterviews}
              onOpenBatchDelete={(filteredIds, hasActiveFilter) =>
                setBatchDeleteState({ kind: 'interview', filteredIds, hasActiveFilter })
              }
              onFilterEmail={(iv) =>
                setEmailFilterTarget({
                  kind: 'interview',
                  id: iv.id,
                  label: `${iv.company} — ${iv.role_title}`,
                })
              }
            />
          ) : activeTab === 'alerts' ? (
            <JobAlertsView
              alerts={alerts}
              sources={dashboard?.alert_sources || []}
              onUpdateStatus={handleUpdateAlertStatus}
              onBulkUpdateStatus={handleBulkAlertAction}
              onDeleteAlert={handleDeleteAlert}
              onMoveWrongAlert={(alert, target) => setMoveAlertState({ alert, target })}
              onDismissBelowScore={handleDismissBelowScore}
              onRescore={handleRescoreAlerts}
              onOpenBatchDelete={(filteredIds, hasActiveFilter) =>
                setBatchDeleteState({ kind: 'alert', filteredIds, hasActiveFilter })
              }
              onFilterEmail={(alert) =>
                setEmailFilterTarget({
                  kind: 'alert',
                  id: alert.id,
                  label: alert.job_title,
                })
              }
            />
          ) : activeTab === 'scans' ? (
            <ScanLogView
              refreshKey={scanRefreshKey}
              syncing={syncing}
              onSyncInbox={() => handleSyncInbox(false)}
              onForceRescan={() => handleSyncInbox(true)}
            />
          ) : (
            <ProfileSettingsView
              profile={profile}
              imapStatus={imap || null}
              onSaveProfile={handleSaveProfile}
              onOpenImapModal={() => setShowImapModal(true)}
              onOpenOnboarding={() => setShowOnboarding(true)}
              onDataRestored={loadAllData}
            />
          )}
        </main>
      </div>

      <ApplicationDrawer
        application={selectedApp}
        onClose={() => setSelectedApp(null)}
        onSave={handleSaveApp}
        onDelete={handleDeleteApp}
        onFilterEmail={(app) =>
          setEmailFilterTarget({
            kind: 'application',
            id: app.id,
            label: `${app.role_title} at ${app.company}`,
          })
        }
      />

      <AddApplicationModal
        open={showAddApp}
        onClose={() => setShowAddApp(false)}
        onCreate={handleCreateApp}
      />

      <AddInterviewModal
        open={showAddInterview}
        onClose={() => setShowAddInterview(false)}
        onCreate={handleCreateInterview}
      />

      <MoveAlertModal
        alert={moveAlertState?.alert ?? null}
        initialTarget={moveAlertState?.target ?? 'application'}
        onClose={() => setMoveAlertState(null)}
        onConfirm={handleConvertAlert}
      />

      <DuplicateGuardModal
        open={duplicateGuard !== null}
        candidate={duplicateGuard?.candidate ?? null}
        matches={duplicateGuard?.matches ?? []}
        onCancel={() => setDuplicateGuard(null)}
        onUpdateExisting={handleResolveDuplicateUpdate}
        onAddAnyway={handleResolveDuplicateAddAnyway}
      />

      <ImapModal
        open={showImapModal}
        status={imap || null}
        onClose={() => setShowImapModal(false)}
        onConnected={loadAllData}
        onDisconnect={handleDisconnectImap}
      />

      <OnboardingWizard
        open={showOnboarding}
        imapStatus={imap || null}
        profile={profile}
        onFinish={async () => {
          setShowOnboarding(false);
          await loadAllData();
        }}
        onSkip={async () => {
          await api.completeOnboarding().catch(() => {});
          setShowOnboarding(false);
          await loadAllData();
        }}
      />

      <BatchDeleteKeywordModal
        open={batchDeleteState !== null}
        entityLabel={
          batchDeleteState?.kind === 'interview'
            ? 'Interviews'
            : batchDeleteState?.kind === 'alert'
            ? 'Job Alerts'
            : 'Applications'
        }
        allItems={(() => {
          if (!batchDeleteState) return [];
          if (batchDeleteState.kind === 'application') {
            return applications.map(
              (a): BatchDeleteCandidateItem => ({
                id: a.id,
                title: a.role_title,
                subtitle: `${a.company}${a.source_platform ? ` · ${a.source_platform}` : ''}`,
                meta: a.applied_date || a.last_update_date,
                fields: {
                  title: a.role_title,
                  company: a.company,
                  extra: `${a.source_platform} ${a.location} ${a.latest_email_subject} ${a.notes}`,
                },
              }),
            );
          }
          if (batchDeleteState.kind === 'interview') {
            return interviews.map(
              (iv): BatchDeleteCandidateItem => ({
                id: iv.id,
                title: iv.role_title,
                subtitle: `${iv.company} · ${iv.round_label}`,
                meta: iv.scheduled_at.replace('T', ' '),
                fields: {
                  title: iv.role_title,
                  company: iv.company,
                  extra: `${iv.round_label} ${iv.interviewer_names}`,
                },
              }),
            );
          }
          return alerts.map(
            (al): BatchDeleteCandidateItem => ({
              id: al.id,
              title: al.job_title,
              subtitle: `${al.source_app}${al.company_name ? ` · ${al.company_name}` : ''}`,
              meta: `${al.relevance_score}%`,
              fields: {
                title: al.job_title,
                company: al.company_name,
                extra: `${al.source_app} ${al.email_subject}`,
              },
            }),
          );
        })()}
        filteredIds={batchDeleteState?.filteredIds || []}
        hasActiveFilter={batchDeleteState?.hasActiveFilter ?? false}
        onClose={() => setBatchDeleteState(null)}
        onConfirmDelete={async (ids) => {
          if (!batchDeleteState) return;
          if (batchDeleteState.kind === 'application') {
            await handleBulkDeleteApps(ids);
          } else if (batchDeleteState.kind === 'interview') {
            await handleBulkDeleteInterviews(ids);
          } else {
            await handleBulkAlertAction(ids, 'delete');
          }
        }}
      />

      <EmailFilterModal
        target={emailFilterTarget}
        profile={profile}
        onClose={() => setEmailFilterTarget(null)}
        onApplied={async ({ addedNoise, removedAllowed, deletedItem }) => {
          const closingApp =
            deletedItem &&
            emailFilterTarget?.kind === 'application' &&
            selectedApp?.id === emailFilterTarget.id;
          if (closingApp) {
            setSelectedApp(null);
          }
          await loadAllData();
          const summaryParts: string[] = [];
          if (addedNoise.length > 0) {
            summaryParts.push(`added ${addedNoise.join(', ')} to Skip Words`);
          }
          if (removedAllowed.length > 0) {
            summaryParts.push(`removed ${removedAllowed.join(', ')} from Allowed Scan Keywords`);
          }
          if (deletedItem) {
            summaryParts.push('deleted item');
          }
          if (summaryParts.length > 0) {
            setBanner({
              type: 'info',
              text: `Email scan filters updated: ${summaryParts.join(' · ')}.`,
            });
          }
        }}
      />
    </div>
  );
}
