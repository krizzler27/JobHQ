export type ApplicationStatus =
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'ghosted';

export interface Application {
  id: number;
  company: string;
  role_title: string;
  status: ApplicationStatus;
  source_platform: string;
  applied_date: string;
  last_update_date: string;
  location: string;
  notes: string;
  thread_id: string;
  latest_email_subject: string;
  latest_email_snippet: string;
  job_url: string;
  created_at: string;
  updated_at: string;
}

export type InterviewStatus = 'upcoming' | 'completed' | 'cancelled';

export interface Interview {
  id: number;
  application_id: number | null;
  company: string;
  role_title: string;
  round_label: string;
  scheduled_at: string;
  duration_minutes: number;
  timezone: string;
  meeting_link: string;
  job_url: string;
  interviewer_names: string;
  status: InterviewStatus;
  source_message_id: string;
  created_at: string;
}

export type JobAlertStatus = 'suggested' | 'applied' | 'dismissed';

export interface JobAlert {
  id: number;
  job_title: string;
  company_name: string;
  source_app: string;
  relevance_score: number;
  relevance_reason: string;
  status: JobAlertStatus;
  email_subject: string;
  job_url: string;
  received_at: string;
  source_message_id: string;
  created_at: string;
}

export type LlmBackend = 'rules' | 'llama_cpp_python';

export interface ProfileSettings {
  id: number;
  target_titles: string[];
  keywords: string[];
  excluded_keywords: string[];
  preferred_locations: string[];
  scan_subject_keywords: string[];
  scan_sender_keywords: string[];
  scan_exclude_keywords: string[];
  auto_sync_enabled: boolean;
  auto_sync_cron: string;
  auto_sync_days: number;
  next_auto_sync_at: string;
  onboarding_completed: boolean;
  llm_backend: LlmBackend;
  llm_model_path: string;
  last_sync_at: string;
  updated_at: string;
}

export type ImapProvider = 'gmail' | 'outlook' | 'yahoo' | 'custom';

export interface ImapPreset {
  label: string;
  host: string;
  port: number;
  use_ssl: boolean;
  help: string;
}

export interface ImapStatus {
  connected: boolean;
  provider: ImapProvider;
  host: string;
  port: number;
  email: string;
  folder: string;
  folders?: string[];
  use_ssl: boolean;
  has_password: boolean;
  source: 'env' | 'saved' | 'none';
}

export interface RecommendedSlm {
  id: string;
  name: string;
  filename: string;
  size_label: string;
  ram_gb: string;
  best_for: string;
  recommended: boolean;
  download_url: string;
}

export interface DownloadedModel {
  filename: string;
  path: string;
  size_mb: number;
}

export interface LlmRecommendationsResponse {
  models: RecommendedSlm[];
  llama_cpp_installed: boolean;
  auto_cpu_threads: number;
  downloaded_models: DownloadedModel[];
}

export interface ModelDownloadStatus {
  status: 'idle' | 'downloading' | 'completed' | 'error';
  model_id: string;
  filename: string;
  path: string;
  downloaded_mb: number;
  total_mb: number;
  percent: number;
  error: string;
  downloaded_models: DownloadedModel[];
}

export interface ProcessedEmail {
  message_id: string;
  thread_id: string;
  category: 'application_update' | 'interview' | 'job_alert' | 'ignored';
  subject: string;
  sender: string;
  received_at: string;
  processed_at: string;
}

export interface DashboardSummary {
  kpis: {
    active_applications: number;
    upcoming_interviews: number;
    offers: number;
    relevant_alerts: number;
    total_applications: number;
  };
  stage_counts: Record<ApplicationStatus, number>;
  applications: Application[];
  upcoming_interviews: Interview[];
  suggested_alerts: JobAlert[];
  alert_sources: string[];
  last_sync_at: string;
  onboarding_completed: boolean;
  llm_backend: LlmBackend;
  imap: ImapStatus;
}

export interface SyncResult {
  fetched: number;
  filtered_out?: number;
  processed_new: number;
  skipped_existing: number;
  applications_added: number;
  applications_updated: number;
  interviews_added: number;
  alerts_added: number;
  ai_parsed?: number;
  model_unloaded?: boolean;
  parser_mode: string;
  llm_fallback_note?: string;
}

export interface SyncJobStatus {
  status: 'idle' | 'running' | 'completed' | 'cancelled' | 'error';
  phase:
    | 'idle'
    | 'connecting'
    | 'checking_headers'
    | 'downloading'
    | 'reading'
    | 'unloading'
    | 'cancelling'
    | 'done';
  current: number;
  total: number;
  total_headers: number;
  skipped_existing: number;
  filtered_out: number;
  current_subject: string;
  stats: SyncResult;
  error: string;
  started_at: string;
  finished_at: string;
}

export interface LlmTestResult {
  ok: boolean;
  backend: string;
  message: string;
}

export interface DuplicateMatch extends Application {
  match_reason: string;
}

export interface DuplicateCheckResult {
  has_duplicates: boolean;
  matches: DuplicateMatch[];
}

export interface PlatformStat {
  platform: string;
  total: number;
  active: number;
  applied: number;
  interviewing: number;
  offers: number;
  rejected: number;
  ghosted: number;
  response_rate_pct: number;
  interview_rate_pct: number;
  avg_response_days: number | null;
}

export interface WeeklyPacePoint {
  week_start: string;
  label: string;
  count: number;
}

export interface DailyPacePoint {
  date: string;
  label: string;
  short_label: string;
  count: number;
}

export interface AlertSourceStat {
  source_app: string;
  total: number;
  suggested: number;
  applied: number;
  dismissed: number;
  avg_score: number;
}

export interface StatsSummary {
  range_days: number | null;
  funnel: {
    total_applications: number;
    active_count: number;
    stage_counts: Record<ApplicationStatus, number>;
    responded_count: number;
    interview_reached_count: number;
    response_rate_pct: number;
    interview_rate_pct: number;
    offer_rate_pct: number;
    ghosted_rate_pct: number;
    avg_response_days: number | null;
  };
  platforms: PlatformStat[];
  weekly_pace: WeeklyPacePoint[];
  pace_summary: {
    this_week_count: number;
    avg_per_week: number;
    peak_label: string;
    peak_count: number;
  };
  daily_pace: DailyPacePoint[];
  daily_pace_summary: {
    today_count: number;
    avg_per_day: number;
    peak_label: string;
    peak_count: number;
  };
  alert_stats: {
    total_alerts: number;
    suggested: number;
    applied: number;
    dismissed: number;
    relevant_count: number;
    strong_match_count: number;
    conversion_rate_pct: number;
    triaged_conversion_pct: number;
    top_sources: AlertSourceStat[];
  };
}

export interface BackupImportResult {
  mode: 'merge' | 'replace';
  added: {
    applications: number;
    interviews: number;
    job_alerts: number;
  };
  skipped: {
    applications: number;
    interviews: number;
    job_alerts: number;
  };
  profile_updated: boolean;
}

export interface EmailFilterContext {
  kind: 'application' | 'interview' | 'alert';
  id: number;
  title: string;
  subtitle: string;
  sender: string;
  sender_email: string;
  sender_domain: string;
  subject: string;
  email_found: boolean;
  matched_subject_keywords: string[];
  matched_sender_keywords: string[];
  suggested_noise_terms: string[];
}

export interface WorkerIntervalOption {
  label: string;
  minutes: number;
}

export interface WorkerThresholdOption {
  label: string;
  value: number;
}

export interface WorkerConfig {
  name: string;
  title: string;
  category: string;
  description: string;
  interval_minutes: number;
  unit: string;
  interval_options: WorkerIntervalOption[];
  threshold_days?: number | null;
  threshold_label?: string | null;
  threshold_options?: WorkerThresholdOption[] | null;
  is_enabled: boolean;
  last_run_at: string | null;
  last_status: 'never_run' | 'success' | 'failed' | 'running';
  last_duration_seconds: number | null;
  last_error: string | null;
  updated_at: string | null;
}

