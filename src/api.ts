import type {
  Application,
  ApplicationStatus,
  BackupImportResult,
  DashboardSummary,
  DuplicateCheckResult,
  EmailFilterContext,
  ImapPreset,
  ImapProvider,
  ImapStatus,
  Interview,
  InterviewStatus,
  JobAlert,
  JobAlertStatus,
  LlmBackend,
  LlmRecommendationsResponse,
  LlmTestResult,
  ModelDownloadStatus,
  ProcessedEmail,
  ProfileSettings,
  StatsSummary,
  SyncJobStatus,
} from './types';

export interface AlertConvertPayload {
  target: 'application' | 'interview';
  company?: string;
  role_title?: string;
  status?: ApplicationStatus;
  source_platform?: string;
  applied_date?: string;
  round_label?: string;
  scheduled_at?: string;
  timezone?: string;
  meeting_link?: string;
  interviewer_names?: string;
  job_url?: string;
  resolve_duplicate?: 'update_existing' | 'add_anyway';
  existing_app_id?: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || data?.detail || `Request failed (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  getDashboard: () => request<DashboardSummary>('/api/dashboard'),

  getStats: (days: '3' | '7' | '15' | '30' | '90' | 'all' = 'all') =>
    request<StatsSummary>(`/api/stats?days=${encodeURIComponent(days)}`),

  getImapStatus: () =>
    request<{ status: ImapStatus; presets: Record<ImapProvider, ImapPreset> }>(
      '/api/imap/status',
    ),

  listImapFolders: (payload: {
    provider: ImapProvider;
    host: string;
    port: number;
    email: string;
    password: string;
    use_ssl?: boolean;
  }) =>
    request<{ folders: string[] }>('/api/imap/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  connectImap: (payload: {
    provider: ImapProvider;
    host: string;
    port: number;
    email: string;
    password: string;
    folder?: string;
    folders?: string[];
    use_ssl?: boolean;
  }) =>
    request<{
      status: ImapStatus;
      mailbox_messages: number;
      folders_checked?: string[];
      missing_folders?: string[];
    }>('/api/imap/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  disconnectImap: () =>
    request<{ status: ImapStatus }>('/api/imap/disconnect', { method: 'DELETE' }),

  syncImap: (days = 1, force_rescan = false) =>
    request<SyncJobStatus>('/api/imap/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days, force_rescan }),
    }),

  getSyncStatus: () => request<SyncJobStatus>('/api/imap/sync-status'),

  cancelSync: () =>
    request<SyncJobStatus>('/api/imap/sync-cancel', { method: 'POST' }),

  listApplications: (status = 'all', search = '') => {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    return request<{ applications: Application[] }>(`/api/applications?${params.toString()}`);
  },

  checkDuplicateApplication: (payload: {
    company?: string;
    role_title?: string;
    job_url?: string;
    exclude_id?: number;
  }) =>
    request<DuplicateCheckResult>('/api/applications/check-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  createApplication: (payload: Partial<Application>) =>
    request<Application>('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  updateApplication: (id: number, payload: Partial<Application> & { merge?: boolean }) =>
    request<Application>(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  deleteApplication: (id: number) =>
    request<{ deleted: boolean }>(`/api/applications/${id}`, { method: 'DELETE' }),

  bulkApplications: (payload: {
    ids: number[];
    action: 'move_stage' | 'delete';
    status?: ApplicationStatus;
  }) =>
    request<{ updated: number; deleted: number }>('/api/applications/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  listInterviews: (status = 'all') => {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    return request<{ interviews: Interview[] }>(`/api/interviews?${params.toString()}`);
  },

  createInterview: (payload: Partial<Interview>) =>
    request<Interview>('/api/interviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  updateInterview: (id: number, payload: { status?: InterviewStatus } & Partial<Interview>) =>
    request<Interview>(`/api/interviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  deleteInterview: (id: number) =>
    request<{ deleted: boolean }>(`/api/interviews/${id}`, { method: 'DELETE' }),

  bulkInterviews: (payload: { ids: number[]; action: 'delete' }) =>
    request<{ deleted: number }>('/api/interviews/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  listAlerts: (opts?: {
    status?: string;
    source_app?: string;
    min_score?: number;
    search?: string;
  }) => {
    const params = new URLSearchParams();
    if (opts?.status && opts.status !== 'all') params.set('status', opts.status);
    if (opts?.source_app && opts.source_app !== 'all') params.set('source_app', opts.source_app);
    if (opts?.min_score) params.set('min_score', String(opts.min_score));
    if (opts?.search?.trim()) params.set('search', opts.search.trim());
    return request<{ alerts: JobAlert[] }>(`/api/alerts?${params.toString()}`);
  },

  updateAlertStatus: (
    id: number,
    status: JobAlertStatus,
    opts?: {
      resolve_duplicate?: 'update_existing' | 'add_anyway';
      existing_app_id?: number;
    },
  ) =>
    request<
      JobAlert & {
        created_application?: Application | null;
        updated_application?: Application | null;
      }
    >(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...(opts || {}) }),
    }),

  convertAlert: (id: number, payload: AlertConvertPayload) =>
    request<{
      target: 'application' | 'interview';
      application: Application;
      interview: Interview | null;
    }>(`/api/alerts/${id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  deleteAlert: (id: number) =>
    request<{ deleted: boolean }>(`/api/alerts/${id}`, { method: 'DELETE' }),

  rescoreAlerts: () =>
    request<{ rescored: number }>('/api/alerts/rescore', { method: 'POST' }),

  bulkAlerts: (payload: {
    ids?: number[];
    action: 'dismiss' | 'apply' | 'restore' | 'delete' | 'dismiss_below_score';
    min_score?: number;
  }) =>
    request<{ updated: number; created_applications: number; deleted?: number }>('/api/alerts/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getProfile: () => request<ProfileSettings>('/api/profile'),

  updateProfile: (payload: Partial<ProfileSettings>) =>
    request<ProfileSettings>('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  resetScanFilters: () =>
    request<ProfileSettings>('/api/profile/reset-scan-filters', { method: 'POST' }),

  completeOnboarding: () =>
    request<ProfileSettings>('/api/onboarding/complete', { method: 'POST' }),

  getRecommendedSlms: () =>
    request<LlmRecommendationsResponse>('/api/llm/recommendations'),

  testLlmEngine: (payload: { llm_backend: LlmBackend; llm_model_path: string }) =>
    request<LlmTestResult>('/api/llm/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  downloadLlmModel: (model_id: string) =>
    request<ModelDownloadStatus>('/api/llm/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id }),
    }),

  getDownloadStatus: () => request<ModelDownloadStatus>('/api/llm/download-status'),

  getEmailLog: (opts?: { category?: string; search?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (opts?.category && opts.category !== 'all') params.set('category', opts.category);
    if (opts?.search?.trim()) params.set('search', opts.search.trim());
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return request<{ emails: ProcessedEmail[]; total: number }>(`/api/emails/log${qs ? `?${qs}` : ''}`);
  },

  clearIgnoredEmails: () =>
    request<{ deleted: number }>('/api/emails/log/ignored', { method: 'DELETE' }),

  getEmailFilterContext: (kind: 'application' | 'interview' | 'alert', id: number) => {
    const params = new URLSearchParams({ kind, id: String(id) });
    return request<EmailFilterContext>(`/api/emails/filter-context?${params.toString()}`);
  },

  downloadBackupFile: async (kind: 'json' | 'sqlite') => {
    const url = kind === 'json' ? '/api/backup/export' : '/api/backup/sqlite';
    const res = await fetch(url);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || data?.detail || `Backup download failed (${res.status})`);
    }
    const blob = await res.blob();
    const stamp = new Date().toISOString().slice(0, 10);
    const filename =
      kind === 'json' ? `job-tracker-backup-${stamp}.json` : `job-tracker-${stamp}.db`;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  },

  importJsonBackup: (payload: {
    mode: 'merge' | 'replace';
    include_profile: boolean;
    backup: Record<string, unknown>;
  }) =>
    request<BackupImportResult>('/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};

export const APPLICATION_STAGES: {
  key: ApplicationStatus;
  label: string;
  tone: string;
}[] = [
  { key: 'applied', label: 'Applied', tone: 'text-slate-700' },
  { key: 'interviewing', label: 'Interviewing', tone: 'text-blue-700' },
  { key: 'offer', label: 'Offer', tone: 'text-emerald-700' },
  { key: 'rejected', label: 'Rejected', tone: 'text-rose-700' },
  { key: 'ghosted', label: 'Ghosted', tone: 'text-amber-700' },
];
