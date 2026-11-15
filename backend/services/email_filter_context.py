"""Resolves source email metadata and scan-filter suggestions for non-career item triage."""

import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.models import Application, Interview, JobAlert, ProcessedEmail
from backend.repositories.profile import ProfileRepository

_COMMON_WEBMAIL_DOMAINS = {
    "gmail.com",
    "outlook.com",
    "hotmail.com",
    "yahoo.com",
    "icloud.com",
    "live.com",
    "proton.me",
    "protonmail.com",
}
_SUBJECT_NOISE_STOPWORDS = {
    "your",
    "with",
    "from",
    "this",
    "that",
    "have",
    "about",
    "update",
    "status",
    "jobs",
    "role",
    "position",
    "application",
    "applied",
    "interview",
    "career",
    "careers",
    "team",
    "hiring",
    "thank",
    "thanks",
}
_EMAIL_ADDR_RE = re.compile(r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)")


class EmailFilterContextService:
    """Resolves linked ProcessedEmail details and matching scan filter rules for an item."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_context(self, kind: str, item_id: int) -> dict[str, Any] | None:
        norm_kind = kind.strip().lower()
        pe: ProcessedEmail | None = None
        fallback_subject = ""
        title = ""
        subtitle = ""

        if norm_kind == "alert":
            alert = self.session.get(JobAlert, item_id)
            if not alert:
                return None
            title = alert.job_title
            subtitle = f"{alert.source_app}" + (
                f" · {alert.company_name}" if alert.company_name else ""
            )
            fallback_subject = alert.email_subject or alert.job_title
            if alert.source_message_id:
                pe = self.session.get(ProcessedEmail, alert.source_message_id)
            if not pe and alert.email_subject:
                pe = self.session.scalar(
                    select(ProcessedEmail)
                    .where(ProcessedEmail.subject == alert.email_subject)
                    .order_by(ProcessedEmail.processed_at.desc())
                    .limit(1)
                )
        elif norm_kind == "interview":
            iv = self.session.get(Interview, item_id)
            if not iv:
                return None
            title = f"{iv.company} — {iv.role_title}"
            subtitle = iv.round_label
            if iv.source_message_id:
                pe = self.session.get(ProcessedEmail, iv.source_message_id)
            if not pe and iv.application_id:
                linked_app = self.session.get(Application, iv.application_id)
                if linked_app:
                    fallback_subject = linked_app.latest_email_subject or ""
                    if linked_app.thread_id:
                        pe = self.session.scalar(
                            select(ProcessedEmail)
                            .where(ProcessedEmail.thread_id == linked_app.thread_id)
                            .order_by(ProcessedEmail.processed_at.desc())
                            .limit(1)
                        )
                    if not pe and linked_app.latest_email_subject:
                        pe = self.session.scalar(
                            select(ProcessedEmail)
                            .where(ProcessedEmail.subject == linked_app.latest_email_subject)
                            .order_by(ProcessedEmail.processed_at.desc())
                            .limit(1)
                        )
            if not fallback_subject:
                fallback_subject = f"{iv.company} {iv.role_title}".strip()
        elif norm_kind == "application":
            app_row = self.session.get(Application, item_id)
            if not app_row:
                return None
            title = app_row.role_title
            subtitle = app_row.company + (
                f" · {app_row.source_platform}" if app_row.source_platform else ""
            )
            fallback_subject = app_row.latest_email_subject or ""
            if app_row.thread_id:
                pe = self.session.scalar(
                    select(ProcessedEmail)
                    .where(ProcessedEmail.thread_id == app_row.thread_id)
                    .order_by(ProcessedEmail.processed_at.desc())
                    .limit(1)
                )
            if not pe and app_row.latest_email_subject:
                pe = self.session.scalar(
                    select(ProcessedEmail)
                    .where(ProcessedEmail.subject == app_row.latest_email_subject)
                    .order_by(ProcessedEmail.processed_at.desc())
                    .limit(1)
                )
        else:
            raise ValueError("Filter context kind must be 'application', 'interview', or 'alert'.")

        sender = (pe.sender if pe else "") or ""
        subject = ((pe.subject if pe else "") or fallback_subject or "").strip()

        email_match = _EMAIL_ADDR_RE.search(sender)
        sender_email = email_match.group(1).lower() if email_match else ""
        sender_domain = sender_email.split("@", 1)[1] if "@" in sender_email else ""

        profile = ProfileRepository(self.session).get_or_create().to_dict()
        subj_low = subject.lower()
        sender_low = sender.lower()
        existing_exclude = {x.lower() for x in profile.get("scan_exclude_keywords", [])}

        matched_subject_keywords = [
            kw
            for kw in profile.get("scan_subject_keywords", [])
            if kw and kw.lower() in subj_low
        ]
        matched_sender_keywords = [
            kw
            for kw in profile.get("scan_sender_keywords", [])
            if kw and kw.lower() in sender_low
        ]

        suggested_terms: list[str] = []
        seen_terms: set[str] = set()

        def _add_suggestion(term: str) -> None:
            clean = term.strip()
            low = clean.lower()
            if not clean or len(clean) < 3 or low in seen_terms or low in existing_exclude:
                return
            seen_terms.add(low)
            suggested_terms.append(clean)

        if sender_email:
            _add_suggestion(sender_email)
        if sender_domain and sender_domain not in _COMMON_WEBMAIL_DOMAINS:
            _add_suggestion(sender_domain)

        for token in re.findall(r"[A-Za-z0-9][A-Za-z0-9._-]{3,}", subject):
            low = token.lower()
            if low in _SUBJECT_NOISE_STOPWORDS or low.isdigit():
                continue
            _add_suggestion(token)
            if len(suggested_terms) >= 8:
                break

        return {
            "kind": norm_kind,
            "id": item_id,
            "title": title,
            "subtitle": subtitle,
            "sender": sender,
            "sender_email": sender_email,
            "sender_domain": sender_domain,
            "subject": subject,
            "email_found": pe is not None,
            "matched_subject_keywords": matched_subject_keywords,
            "matched_sender_keywords": matched_sender_keywords,
            "suggested_noise_terms": suggested_terms,
        }
