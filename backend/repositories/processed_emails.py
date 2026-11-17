"""Repository for processed email log deduplication, filtering, and ignored cleanup."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.core.models import ProcessedEmail, now_iso


class ProcessedEmailRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def is_processed(self, message_id: str) -> bool:
        return self.session.get(ProcessedEmail, message_id) is not None

    def get_processed_ids(self, message_ids: list[str]) -> set[str]:
        if not message_ids:
            return set()
        found: set[str] = set()
        for i in range(0, len(message_ids), 200):
            chunk = message_ids[i : i + 200]
            rows = self.session.scalars(
                select(ProcessedEmail.message_id).where(ProcessedEmail.message_id.in_(chunk))
            )
            found.update(rows)
        return found

    def upsert(
        self,
        message_id: str,
        thread_id: str,
        category: str,
        subject: str,
        sender: str,
        received_at: str,
    ) -> None:
        existing = self.session.get(ProcessedEmail, message_id)
        ts = now_iso()
        if existing:
            existing.thread_id = thread_id
            existing.category = category
            existing.subject = subject[:255]
            existing.sender = sender[:160]
            existing.received_at = received_at
            existing.processed_at = ts
        else:
            self.session.add(
                ProcessedEmail(
                    message_id=message_id,
                    thread_id=thread_id,
                    category=category,
                    subject=subject[:255],
                    sender=sender[:160],
                    received_at=received_at,
                    processed_at=ts,
                )
            )
        self.session.flush()

    def _filtered_stmt(self, category: str = "", search: str = ""):
        stmt = select(ProcessedEmail)
        if category and category != "all":
            stmt = stmt.where(ProcessedEmail.category == category)
        if search.strip():
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    ProcessedEmail.subject.ilike(like),
                    ProcessedEmail.sender.ilike(like),
                    ProcessedEmail.category.ilike(like),
                )
            )
        return stmt

    def list_recent(
        self, limit: int = 200, offset: int = 0, category: str = "", search: str = ""
    ) -> list[ProcessedEmail]:
        stmt = (
            self._filtered_stmt(category=category, search=search)
            .order_by(ProcessedEmail.processed_at.desc())
            .offset(max(0, offset))
            .limit(limit)
        )
        return list(self.session.scalars(stmt))

    def count_filtered(self, category: str = "", search: str = "") -> int:
        subq = self._filtered_stmt(category=category, search=search).subquery()
        return int(self.session.scalar(select(func.count()).select_from(subq)) or 0)

    def clear_ignored(self) -> int:
        rows = list(
            self.session.scalars(
                select(ProcessedEmail).where(ProcessedEmail.category == "ignored")
            )
        )
        for row in rows:
            self.session.delete(row)
        self.session.flush()
        return len(rows)

    def prune_older_than(self, cutoff_date: str) -> int:
        """Prunes raw metadata (subject, sender) from processed emails older than cutoff_date.

        Preserves message_id, category, and timestamps so deduplication is never broken.
        """
        rows = list(
            self.session.scalars(
                select(ProcessedEmail).where(
                    ProcessedEmail.processed_at < cutoff_date,
                    or_(ProcessedEmail.subject != "", ProcessedEmail.sender != ""),
                )
            )
        )
        for row in rows:
            row.subject = ""
            row.sender = ""
        if rows:
            self.session.flush()
        return len(rows)
