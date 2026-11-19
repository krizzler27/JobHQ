"""IMAP inbox sync orchestration, background job manager, and cron auto-sync scheduler."""

import imaplib
import logging
import threading
import time
from datetime import datetime
from typing import Callable

from backend.core.database import DatabaseManager
from backend.core.models import now_iso
from backend.imap.client import ImapClient, SyncCancelledError
from backend.llm.runtime import (
    LlamaCppPythonAdapter,
    LocalLlmProvider,
    get_llm_adapter,
    test_llm_engine,
)
from backend.parsing.classifier import (
    classify_email,
    detect_source_app,
    has_strong_transactional_signal,
    header_matches_job_filter,
)
from backend.parsing.extractors import (
    extract_application_info,
    extract_interview_info,
    extract_job_alert_titles,
    needs_ai_refinement,
)
from backend.parsing.html_links import match_job_alert_link, merge_link_items
from backend.parsing.scorer import score_job_title
from backend.repositories.alerts import JobAlertRepository
from backend.repositories.applications import ApplicationRepository
from backend.repositories.imap_config import ImapConfigRepository
from backend.repositories.interviews import InterviewRepository
from backend.repositories.processed_emails import ProcessedEmailRepository
from backend.repositories.profile import ProfileRepository

logger = logging.getLogger("job_tracker.sync")


class ImapSyncService:
    """Orchestrates two-stage IMAP fetching, smart hybrid SLM/Python parsing, and SQLAlchemy ingestion."""

    def __init__(self, db_manager: DatabaseManager) -> None:
        self.db_manager = db_manager

    def sync(
        self,
        days: int = 30,
        force_rescan: bool = False,
        cancel_event: threading.Event | None = None,
        progress_cb: Callable[[dict], None] | None = None,
    ) -> dict:
        t0 = time.monotonic()
        with self.db_manager.session_scope() as session:
            creds, source = ImapConfigRepository(session).get_effective_credentials()
            if source == "none":
                raise ValueError("IMAP mailbox is not configured. Connect your email first.")
            profile_dict = ProfileRepository(session).get_or_create().to_dict()
            past_apps = [a.to_dict() for a in ApplicationRepository(session).list_filtered()]

        known_thread_ids = {
            str(a.get("thread_id", "")).strip() for a in past_apps if str(a.get("thread_id", "")).strip()
        }
        active_companies: list[str] = []
        seen_companies: set[str] = set()
        for app_row in past_apps:
            if app_row.get("status") not in ("applied", "interviewing"):
                continue
            comp = str(app_row.get("company", "")).strip()
            comp_low = comp.lower()
            if (
                len(comp) >= 3
                and comp_low not in ("unknown", "unknown company")
                and comp_low not in seen_companies
            ):
                seen_companies.add(comp_low)
                active_companies.append(comp)
            if len(active_companies) >= 20:
                break

        backend = profile_dict.get("llm_backend", "rules")
        model_path = profile_dict.get("llm_model_path", "")

        logger.info(
            "[sync] Starting inbox sync (days=%d, folders=%s, mode=%s, force=%s)",
            days,
            creds["folder"],
            backend,
            force_rescan,
        )

        if progress_cb:
            progress_cb({"phase": "checking_headers", "current": 0, "total": 0})

        llm_adapter = None
        llm_status_note = ""
        if backend == "llama_cpp_python":
            probe = test_llm_engine(backend, model_path)
            if probe.get("ok"):
                llm_adapter = get_llm_adapter(backend, model_path)
            else:
                llm_status_note = "Local AI model is not ready yet; used built-in reader instead."
                logger.warning("[sync] %s", llm_status_note)

        client = ImapClient(
            host=creds["host"],
            port=creds["port"],
            username=creds["email"],
            password=creds["password"],
            folder=creds["folder"],
            use_ssl=creds["use_ssl"],
        )

        stats = {
            "fetched": 0,
            "filtered_out": 0,
            "processed_new": 0,
            "skipped_existing": 0,
            "applications_added": 0,
            "applications_updated": 0,
            "interviews_added": 0,
            "alerts_added": 0,
            "ai_parsed": 0,
            "model_unloaded": False,
            "parser_mode": "local-ai" if llm_adapter else "built-in",
        }
        if llm_status_note:
            stats["llm_fallback_note"] = llm_status_note

        def _check_processed_ids(msg_ids: list[str]) -> set[str]:
            with self.db_manager.session_scope() as session:
                return ProcessedEmailRepository(session).get_processed_ids(msg_ids)

        def _is_job_header(hdr: dict) -> bool:
            return header_matches_job_filter(
                sender=hdr["sender"],
                subject=hdr["subject"],
                thread_id=hdr["thread_id"],
                profile=profile_dict,
                known_thread_ids=known_thread_ids,
                active_companies=active_companies,
            )

        try:
            fetch_res = client.fetch_headers_and_bodies(
                days=days,
                limit_per_folder=1000,
                is_already_processed=_check_processed_ids,
                is_job_header=_is_job_header,
                force_rescan=force_rescan,
                cancel_event=cancel_event,
                progress_cb=progress_cb,
                profile=profile_dict,
                active_companies=active_companies,
            )

            stats["fetched"] = fetch_res["total_headers"]
            stats["skipped_existing"] = fetch_res["skipped_existing"]
            filtered_out_headers = fetch_res["filtered_out_headers"]
            stats["filtered_out"] = len(filtered_out_headers)
            messages = fetch_res["messages"]

            if filtered_out_headers:
                with self.db_manager.session_scope() as session:
                    email_repo = ProcessedEmailRepository(session)
                    for hdr in filtered_out_headers:
                        email_repo.upsert(
                            message_id=hdr["id"],
                            thread_id=hdr["thread_id"],
                            category="ignored",
                            subject=hdr["subject"],
                            sender=hdr["sender"],
                            received_at=hdr["date_iso"],
                        )

            total_msgs = len(messages)
            for idx, msg in enumerate(messages, start=1):
                if cancel_event and cancel_event.is_set():
                    raise SyncCancelledError(
                        f"Sync cancelled after {idx - 1}/{total_msgs} matching email(s)."
                    )
                if progress_cb:
                    progress_cb(
                        {
                            "phase": "reading",
                            "current": idx,
                            "total": total_msgs,
                            "current_subject": msg["subject"][:100],
                            "stats": dict(stats),
                        }
                    )
                self._ingest_message(
                    idx, total_msgs, msg, profile_dict, past_apps, llm_adapter, stats
                )

            with self.db_manager.session_scope() as session:
                ApplicationRepository(session).auto_ghost_stale(days_threshold=10)
                ProfileRepository(session).touch_last_sync()

            elapsed = time.monotonic() - t0
            logger.info(
                "[sync] Done in %.2fs — headers=%d, filtered=%d, processed=%d, ai_calls=%d, apps(+%d/~%d), interviews=+%d, alerts=+%d",
                elapsed,
                stats["fetched"],
                stats["filtered_out"],
                stats["processed_new"],
                stats["ai_parsed"],
                stats["applications_added"],
                stats["applications_updated"],
                stats["interviews_added"],
                stats["alerts_added"],
            )
            return stats
        finally:
            if llm_adapter is not None or backend == "llama_cpp_python":
                if progress_cb:
                    progress_cb({"phase": "unloading", "current_subject": ""})
                unloaded = LlamaCppPythonAdapter.unload()
                stats["model_unloaded"] = unloaded
                if progress_cb:
                    progress_cb({"stats": dict(stats)})

    def _ingest_message(
        self,
        idx: int,
        total_msgs: int,
        msg: dict,
        profile_dict: dict,
        past_apps: list[dict],
        llm_adapter: LocalLlmProvider | None,
        stats: dict,
    ) -> None:
        sender = msg["sender"]
        subject = msg["subject"]
        body = msg["body"]
        date_iso = msg["date_iso"]
        thread_id = msg["thread_id"]
        snippet = msg["snippet"]
        links = msg["links"]
        link_items = msg.get("link_items") or []
        msg_id = msg["id"]

        category = classify_email(sender, subject, body)
        used_ai = False
        llm_data = None

        if llm_adapter and needs_ai_refinement(category, sender, subject, body):
            logger.info("[sync] [%d/%d] Escalating to Local AI: %s", idx, total_msgs, subject[:80])
            llm_data = llm_adapter.parse_email(sender, subject, body)
            if llm_data:
                used_ai = True
                stats["ai_parsed"] += 1
                ai_cat = llm_data.get("category")
                if ai_cat in ("application_update", "interview", "job_alert", "ignored"):
                    strong_tx = has_strong_transactional_signal(subject, body)
                    if category in ("application_update", "interview") and strong_tx and ai_cat in ("job_alert", "ignored"):
                        pass
                    elif (
                        ai_cat == "job_alert"
                        and not (
                            isinstance(llm_data.get("job_titles"), list)
                            and any(str(t).strip() for t in llm_data["job_titles"])
                        )
                        and not extract_job_alert_titles(subject, body, link_items=link_items)
                    ):
                        pass
                    else:
                        category = ai_cat

        extracted_alerts: list[dict] = []
        alert_source_app = ""
        if category == "job_alert":
            alert_source_app = (
                str(llm_data.get("source_app") or "").strip() if llm_data else ""
            ) or detect_source_app(sender, subject, body)
            extracted_alerts = extract_job_alert_titles(
                subject, body, link_items=link_items
            )
            clean_links = merge_link_items(link_items, body)
            if llm_data and isinstance(llm_data.get("job_titles"), list):
                seen_titles = {x["job_title"].lower() for x in extracted_alerts}
                for jt in llm_data["job_titles"]:
                    clean_jt = str(jt).strip()
                    if clean_jt and clean_jt.lower() not in seen_titles:
                        extracted_alerts.append(
                            {
                                "job_title": clean_jt,
                                "company_name": "",
                                "job_url": match_job_alert_link(
                                    clean_jt, "", clean_links
                                ),
                            }
                        )
                        seen_titles.add(clean_jt.lower())

            if not extracted_alerts:
                if has_strong_transactional_signal(subject, body):
                    category = "application_update"
                else:
                    category = "ignored"

        logger.info(
            "[sync] [%d/%d] -> %s (%s): %s",
            idx,
            total_msgs,
            category,
            "local-ai" if used_ai else "rules",
            subject[:80],
        )

        with self.db_manager.session_scope() as session:
            app_repo = ApplicationRepository(session)
            iv_repo = InterviewRepository(session)
            alert_repo = JobAlertRepository(session)
            email_repo = ProcessedEmailRepository(session)

            if category == "application_update":
                info = extract_application_info(
                    sender, subject, body, link_items=link_items
                )
                if llm_data:
                    info["company"] = str(llm_data.get("company") or "").strip() or info["company"]
                    info["role_title"] = (
                        str(llm_data.get("role_title") or "").strip() or info["role_title"]
                    )
                    if llm_data.get("status") in (
                        "applied",
                        "interviewing",
                        "offer",
                        "rejected",
                        "ghosted",
                    ):
                        info["status"] = llm_data["status"]

                existing = app_repo.find_match(thread_id, info["company"], info["role_title"])
                if existing:
                    update_payload = {
                        "status": info["status"],
                        "last_update_date": date_iso[:10],
                        "latest_email_subject": subject[:200],
                        "latest_email_snippet": snippet[:300],
                    }
                    if info.get("job_url") and not existing.job_url:
                        update_payload["job_url"] = info["job_url"]
                    app_repo.update(existing.id, update_payload)
                    if not existing.thread_id and thread_id:
                        existing.thread_id = thread_id
                    stats["applications_updated"] += 1
                else:
                    created = app_repo.create(
                        {
                            **info,
                            "applied_date": date_iso[:10],
                            "last_update_date": date_iso[:10],
                            "thread_id": thread_id,
                            "latest_email_subject": subject[:200],
                            "latest_email_snippet": snippet[:300],
                        }
                    )
                    past_apps.append(created.to_dict())
                    stats["applications_added"] += 1

            elif category == "interview":
                iv_info = extract_interview_info(
                    sender, subject, body, links, date_iso, link_items=link_items
                )
                if llm_data:
                    iv_info["company"] = (
                        str(llm_data.get("company") or "").strip() or iv_info["company"]
                    )
                    iv_info["role_title"] = (
                        str(llm_data.get("role_title") or "").strip() or iv_info["role_title"]
                    )
                    iv_info["round_label"] = (
                        str(llm_data.get("round_label") or "").strip() or iv_info["round_label"]
                    )
                    if llm_data.get("scheduled_at"):
                        iv_info["scheduled_at"] = str(llm_data["scheduled_at"]).strip()
                    if llm_data.get("meeting_link"):
                        iv_info["meeting_link"] = str(llm_data["meeting_link"]).strip()

                existing = app_repo.find_match(
                    thread_id, iv_info["company"], iv_info["role_title"]
                )
                if existing:
                    app_id = existing.id
                    if not iv_info.get("job_url") and existing.job_url:
                        iv_info["job_url"] = existing.job_url
                    if existing.status in ("applied", "ghosted"):
                        update_payload = {
                            "status": "interviewing",
                            "last_update_date": date_iso[:10],
                            "latest_email_subject": subject[:200],
                            "latest_email_snippet": snippet[:300],
                        }
                        if iv_info.get("job_url") and not existing.job_url:
                            update_payload["job_url"] = iv_info["job_url"]
                        app_repo.update(existing.id, update_payload)
                        stats["applications_updated"] += 1
                else:
                    created = app_repo.create(
                        {
                            "company": iv_info["company"],
                            "role_title": iv_info["role_title"],
                            "status": "interviewing",
                            "source_platform": iv_info["source_platform"],
                            "applied_date": date_iso[:10],
                            "last_update_date": date_iso[:10],
                            "location": iv_info["location"],
                            "thread_id": thread_id,
                            "latest_email_subject": subject[:200],
                            "latest_email_snippet": snippet[:300],
                            "job_url": iv_info.get("job_url", ""),
                        }
                    )
                    app_id = created.id
                    past_apps.append(created.to_dict())
                    stats["applications_added"] += 1

                if not iv_repo.exists_for_message(msg_id):
                    iv_repo.create(
                        {
                            "application_id": app_id,
                            "company": iv_info["company"],
                            "role_title": iv_info["role_title"],
                            "round_label": iv_info["round_label"],
                            "scheduled_at": iv_info["scheduled_at"],
                            "timezone": iv_info["timezone"],
                            "meeting_link": iv_info["meeting_link"],
                            "job_url": iv_info.get("job_url", ""),
                            "interviewer_names": iv_info["interviewer_names"],
                            "status": "upcoming",
                            "source_message_id": msg_id,
                        }
                    )
                    stats["interviews_added"] += 1

            elif category == "job_alert":
                msg_alerts_added = 0
                for item in extracted_alerts:
                    # 1. Skip duplicate within same email message
                    if alert_repo.exists_for_message_title(
                        item["job_title"], alert_source_app, msg_id
                    ):
                        continue

                    # 2. Skip global duplicate across past emails (canonical URL or title + company/platform)
                    existing_alert = alert_repo.find_existing_alert(
                        job_title=item["job_title"],
                        company_name=item.get("company_name", ""),
                        job_url=item.get("job_url", ""),
                        source_app=alert_source_app,
                    )
                    if existing_alert:
                        # Refresh latest timestamp and job link if new link is better
                        if date_iso > (existing_alert.received_at or ""):
                            existing_alert.received_at = date_iso
                        if item.get("job_url") and not existing_alert.job_url:
                            existing_alert.job_url = item["job_url"]
                        continue

                    score, reason = score_job_title(
                        item["job_title"],
                        item["company_name"],
                        profile_dict,
                        past_apps,
                    )
                    alert_repo.create(
                        {
                            "job_title": item["job_title"],
                            "company_name": item["company_name"],
                            "source_app": alert_source_app,
                            "relevance_score": score,
                            "relevance_reason": reason,
                            "status": "suggested",
                            "email_subject": subject,
                            "job_url": item.get("job_url", ""),
                            "received_at": date_iso,
                            "source_message_id": msg_id,
                        }
                    )
                    stats["alerts_added"] += 1
                    msg_alerts_added += 1

                if msg_alerts_added == 0 and not alert_repo.exists_for_message(msg_id):
                    category = "ignored"

            email_repo.upsert(
                message_id=msg_id,
                thread_id=thread_id,
                category=category,
                subject=subject,
                sender=sender,
                received_at=date_iso,
            )
            stats["processed_new"] += 1


from backend.services.sync_job import SyncJobManager

__all__ = [
    "ImapSyncService",
    "SyncJobManager",
]
