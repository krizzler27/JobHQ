# API Reference

All routes are served by FastAPI (`backend/main.py` + `backend/api/routers/` on `127.0.0.1:3001`) and proxied at `/api/*` by Express (`server.ts` on `127.0.0.1:3000`).

Errors return JSON `{ "error": "..." }` with appropriate `4xx`/`5xx` HTTP status codes.

---

## Health, Dashboard & Stats

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Returns `{"status": "ok", "engine": "fastapi-sqlalchemy-imap"}`. |
| `GET` | `/api/dashboard` | Auto-ghosts stale `applied` rows (10d+), returns `kpis`, `stage_counts`, `applications`, `upcoming_interviews` (top 8), `suggested_alerts` (last 3d, score `>=40`), `alert_sources`, `last_sync_at`, `onboarding_completed`, `llm_backend`, and masked `imap` status. |
| `GET` | `/api/stats?days=all` | Aggregates analytics. Query param `days`: positive integer (`3`, `7`, `15`, `30`, `90`) or `all`. Returns `funnel`, `platforms`, `weekly_pace`, `pace_summary`, `daily_pace`, `daily_pace_summary`, and `alert_stats`. |

---

## Applications & Duplicate Guard

| Method | Endpoint | Body / Query | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/applications` | `?status=&search=` | Lists applications after running 10-day auto-ghosting. |
| `POST` | `/api/applications/check-duplicate` | `{ company, role_title, job_url, exclude_id? }` | Checks for matching `job_url` or normalized `company` + `role_title`. Returns `{ has_duplicates, matches }`. |
| `POST` | `/api/applications` | `ApplicationPayload` | Creates a new application. |
| `PATCH` | `/api/applications/{app_id}` | `ApplicationPayload` (`merge?: bool`) | Updates fields; when `merge=true`, runs `merge_update` (preserves `interviewing`/`offer` stages and appends distinct notes). |
| `DELETE` | `/api/applications/{app_id}` | — | Deletes an application (`404` if missing). |
| `POST` | `/api/applications/bulk` | `{ ids: number[], action: "move_stage" \| "delete", status? }` | Bulk-moves selected applications to `status` or deletes them. Returns `{ updated, deleted }`. |

---

## Interviews

| Method | Endpoint | Body / Query | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/interviews` | `?status=` (`upcoming`, `past`, `completed`, `cancelled`, or empty) | Lists interviews ordered by `scheduled_at` ascending. |
| `POST` | `/api/interviews` | `InterviewPayload` | Creates a new interview (`company`, `role_title`, `round_label`, `scheduled_at`, `duration_minutes`, `timezone`, `meeting_link`, `job_url`, `interviewer_names`, `status`, `application_id`). |
| `PATCH` | `/api/interviews/{iv_id}` | `InterviewPayload` | Updates interview status or fields. |
| `DELETE` | `/api/interviews/{iv_id}` | — | Deletes a single interview. |
| `POST` | `/api/interviews/bulk` | `{ ids: number[], action: "delete" }` | Bulk-deletes selected interviews. Returns `{ deleted }`. |

---

## Job Alerts

| Method | Endpoint | Body / Query | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/alerts` | `?status=&source_app=&min_score=0&search=` | Lists alerts ordered by `relevance_score` descending. |
| `PATCH` | `/api/alerts/{alert_id}` | `{ status, resolve_duplicate?, existing_app_id? }` | Updates status (`suggested`, `applied`, `dismissed`). When moving to `applied`, creates or updates a matching `Application` (`created_application` / `updated_application`). |
| `POST` | `/api/alerts/{alert_id}/convert` | `AlertConvertPayload` | Converts a misclassified alert into an `application` or upcoming `interview` (creating/updating the linked application), updates `processed_emails.category`, and deletes the alert. |
| `DELETE` | `/api/alerts/{alert_id}` | — | Deletes a single job alert. |
| `POST` | `/api/alerts/rescore` | — | Re-computes relevance scores and reasons for all `suggested` alerts using current `ProfileSettings` and `Application` history. |
| `POST` | `/api/alerts/bulk` | `{ ids?, action, min_score? }` | Supports `apply`, `dismiss`, `restore`, `delete`, and `dismiss_below_score` (defaults `<40`). Returns `{ updated, created_applications, deleted }`. |

---

## IMAP Connection & Sync

| Method | Endpoint | Body | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/imap/status` | — | Returns masked connection status (`connected`, `provider`, `host`, `port`, `email`, `folder`, `folders`, `has_password`, `source`) and provider presets. |
| `POST` | `/api/imap/folders` | `{ provider, host, port, email, password, use_ssl }` | Connects to IMAP (using saved/env password if omitted) and returns `{ folders: string[] }`. |
| `POST` | `/api/imap/connect` | `{ provider, host, port, email, password, folder, folders?, use_ssl }` | Tests login and folder selection, encrypts and saves config, and returns `{ status, mailbox_messages, folders_checked, missing_folders }`. |
| `DELETE` | `/api/imap/disconnect` | — | Clears saved email and encrypted password in SQLite. |
| `POST` | `/api/imap/sync` | `{ days: 1..180, force_rescan: bool }` | Starts background `SyncJobManager` worker and returns initial `SyncJobStatus`. |
| `GET` | `/api/imap/sync-status` | — | Polls current `SyncJobStatus` (`status`, `phase`, `current`, `total`, `total_headers`, `skipped_existing`, `filtered_out`, `current_subject`, `stats`, `error`). |
| `POST` | `/api/imap/sync-cancel` | — | Requests cooperative cancellation of the running sync job. |

---

## Profile, Scan Filters & Email Logs

| Method | Endpoint | Body / Query | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/profile` | — | Returns `ProfileSettings` including effective scan keyword lists and computed `next_auto_sync_at`. |
| `PUT` | `/api/profile` | `ProfilePayload` | Updates job goals, scan filters, 5-field Unix cron schedule (validated), `auto_sync_days` (`1..180`), `onboarding_completed`, and `llm_backend` / `llm_model_path`. Automatically rescores alerts. |
| `POST` | `/api/profile/reset-scan-filters` | — | Restores default `scan_subject_keywords` and `scan_sender_keywords` and clears `scan_exclude_keywords`. |
| `POST` | `/api/onboarding/complete` | — | Marks `onboarding_completed = true`. |
| `GET` | `/api/emails/log` | `?category=&search=&limit=25&offset=0` | Paginated `processed_emails` history (`emails`, `total`). |
| `DELETE` | `/api/emails/log/ignored` | — | Deletes `ignored` rows from `processed_emails` so they can be re-evaluated on next sync. |
| `GET` | `/api/emails/filter-context` | `?kind=application\|interview\|alert&id=<int>` | Looks up the originating `ProcessedEmail` for an item and returns `sender`, `sender_email`, `sender_domain`, `subject`, `matched_subject_keywords`, `matched_sender_keywords`, and `suggested_noise_terms`. |

---

## Local AI (`llama-cpp-python`)

| Method | Endpoint | Body | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/llm/recommendations` | — | Lists recommended GGUF models, runtime availability (`llama_cpp_installed`), `auto_cpu_threads`, and `downloaded_models` in `./models/`. |
| `GET` | `/api/llm/status` | — | Returns `llama_cpp_installed`, `auto_cpu_threads`, and `downloaded_models`. |
| `POST` | `/api/llm/test` | `{ llm_backend?, llm_model_path? }` | Verifies rule reader or loads/tests the selected `.gguf` model file. |
| `POST` | `/api/llm/download` | `{ model_id }` | Starts background download of a recommended `.gguf` file into `./models/`. |
| `GET` | `/api/llm/download-status` | — | Polls active download progress (`percent`, `downloaded_mb`, `total_mb`, `status`). |

---

## Backup & Restore

| Method | Endpoint | Body | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/backup/export` | — | Downloads `job-tracker-backup-YYYY-MM-DD.json` containing applications, interviews, job alerts, and profile settings (no IMAP credentials). |
| `GET` | `/api/backup/sqlite` | — | Streams a consistent SQLite hot snapshot `job-tracker-YYYY-MM-DD.db`. |
| `POST` | `/api/backup/import` | `{ mode: "merge" \| "replace", include_profile: bool, backup: object }` | Restores JSON backup (`merge` deduplicates; `replace` overwrites tracked tables while keeping IMAP config). Returns `{ mode, added, skipped, profile_updated }`. |
