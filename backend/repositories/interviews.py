"""Repository for interview CRUD and bulk operations."""

from sqlalchemy import select

from backend.core.constants import VALID_INTERVIEW_STATUSES
from backend.core.models import Interview, now_iso
from backend.core.normalizers import clean_http_url
from backend.repositories.base import BaseRepository


class InterviewRepository(BaseRepository[Interview]):
    model_cls = Interview

    def list_filtered(self, status: str = "") -> list[Interview]:
        stmt = select(Interview)
        if status and status != "all":
            if status == "past":
                stmt = stmt.where(Interview.status.in_(("completed", "cancelled")))
            else:
                stmt = stmt.where(Interview.status == status)
        stmt = stmt.order_by(Interview.scheduled_at.asc(), Interview.id.desc())
        return list(self.session.scalars(stmt))

    def exists_for_message(self, message_id: str) -> bool:
        if not message_id:
            return False
        return (
            self.session.scalar(
                select(Interview.id).where(Interview.source_message_id == message_id).limit(1)
            )
            is not None
        )

    def create(self, payload: dict) -> Interview:
        ts = now_iso()
        status = payload.get("status", "upcoming")
        if status not in VALID_INTERVIEW_STATUSES:
            status = "upcoming"
        iv = Interview(
            application_id=payload.get("application_id"),
            company=str(payload.get("company", "")).strip() or "Unknown Company",
            role_title=str(payload.get("role_title", "")).strip() or "Interview",
            round_label=str(payload.get("round_label", "Interview")).strip() or "Interview",
            scheduled_at=str(payload.get("scheduled_at", ts[:16])).strip(),
            duration_minutes=int(payload.get("duration_minutes") or 45),
            timezone=str(payload.get("timezone", "")).strip(),
            meeting_link=clean_http_url(payload.get("meeting_link", "")),
            job_url=clean_http_url(payload.get("job_url", "")),
            interviewer_names=str(payload.get("interviewer_names", "")).strip(),
            status=status,
            source_message_id=str(payload.get("source_message_id", "")).strip(),
            created_at=ts,
        )
        self.session.add(iv)
        self.session.flush()
        return iv

    def update(self, iv_id: int, payload: dict) -> Interview | None:
        iv = self.get(iv_id)
        if not iv:
            return None
        if payload.get("status") in VALID_INTERVIEW_STATUSES:
            iv.status = payload["status"]
        for field in (
            "company",
            "role_title",
            "round_label",
            "scheduled_at",
            "timezone",
            "interviewer_names",
        ):
            if field in payload:
                setattr(iv, field, str(payload[field]).strip())
        if "meeting_link" in payload:
            iv.meeting_link = clean_http_url(payload["meeting_link"])
        if "job_url" in payload:
            iv.job_url = clean_http_url(payload["job_url"])
        if "duration_minutes" in payload and payload["duration_minutes"]:
            iv.duration_minutes = int(payload["duration_minutes"])
        self.session.flush()
        return iv

    def bulk_delete(self, iv_ids: list[int]) -> int:
        if not iv_ids:
            return 0
        rows = list(
            self.session.scalars(select(Interview).where(Interview.id.in_(iv_ids)))
        )
        for iv in rows:
            self.session.delete(iv)
        self.session.flush()
        return len(rows)

    def bulk_update_status(self, iv_ids: list[int], new_status: str) -> int:
        """Updates the status of multiple interviews."""
        if not iv_ids or new_status not in VALID_INTERVIEW_STATUSES:
            return 0
        rows = list(
            self.session.scalars(select(Interview).where(Interview.id.in_(iv_ids)))
        )
        for iv in rows:
            iv.status = new_status
        self.session.flush()
        return len(rows)
