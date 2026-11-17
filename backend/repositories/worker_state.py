"""Repository for reading, checking, and updating worker execution states and intervals."""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from backend.core.models import WorkerState, now_iso
from backend.repositories.base import BaseRepository


class WorkerStateRepository(BaseRepository[WorkerState]):
    model_cls = WorkerState

    def get_or_create(
        self,
        name: str,
        default_interval_minutes: int = 60,
        default_enabled: bool = True,
        default_threshold_days: int | None = None,
    ) -> WorkerState:
        row = self.session.scalar(select(WorkerState).where(WorkerState.name == name))
        if row:
            if row.threshold_days is None and default_threshold_days is not None:
                row.threshold_days = default_threshold_days
                self.session.flush()
            return row

        row = WorkerState(
            name=name,
            last_run_at=None,
            last_status="never_run",
            last_duration_seconds=0.0,
            last_error=None,
            interval_minutes=max(1, default_interval_minutes),
            threshold_days=default_threshold_days,
            is_enabled=1 if default_enabled else 0,
            updated_at=now_iso(),
        )
        self.session.add(row)
        self.session.flush()
        return row

    def is_due(
        self,
        name: str,
        default_interval_minutes: int = 60,
        default_enabled: bool = True,
        now_dt: datetime | None = None,
    ) -> bool:
        """Determines if a worker is enabled and due to run based on elapsed minutes."""
        ref_now = now_dt or datetime.now(timezone.utc)
        if ref_now.tzinfo is None:
            ref_now = ref_now.replace(tzinfo=timezone.utc)

        state = self.get_or_create(
            name=name,
            default_interval_minutes=default_interval_minutes,
            default_enabled=default_enabled,
        )

        if not state.is_enabled:
            return False

        if not state.last_run_at:
            return True

        try:
            clean_ts = state.last_run_at.replace("Z", "+00:00")
            last_dt = datetime.fromisoformat(clean_ts)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)

            elapsed_minutes = (ref_now - last_dt).total_seconds() / 60.0
            return elapsed_minutes >= state.interval_minutes
        except Exception:
            # If timestamp parsing fails, mark due to self-heal
            return True

    def record_success(
        self,
        name: str,
        duration_seconds: float,
        now_dt: datetime | None = None,
    ) -> WorkerState:
        ref_now = now_dt or datetime.now(timezone.utc)
        ts_str = ref_now.strftime("%Y-%m-%dT%H:%M:%SZ")

        state = self.get_or_create(name)
        state.last_run_at = ts_str
        state.last_status = "success"
        state.last_duration_seconds = max(0.0, round(duration_seconds, 3))
        state.last_error = None
        state.updated_at = ts_str
        self.session.flush()
        return state

    def record_failure(
        self,
        name: str,
        duration_seconds: float,
        error_message: str,
        now_dt: datetime | None = None,
    ) -> WorkerState:
        ref_now = now_dt or datetime.now(timezone.utc)
        ts_str = ref_now.strftime("%Y-%m-%dT%H:%M:%SZ")

        state = self.get_or_create(name)
        state.last_status = "failed"
        state.last_duration_seconds = max(0.0, round(duration_seconds, 3))
        state.last_error = (error_message or "").strip()[:1000]
        state.updated_at = ts_str
        self.session.flush()
        return state

    def update_config(
        self,
        name: str,
        interval_minutes: int | None = None,
        is_enabled: bool | None = None,
        threshold_days: int | None = None,
    ) -> WorkerState | None:
        state = self.get_or_create(name)
        if interval_minutes is not None:
            state.interval_minutes = max(1, interval_minutes)
        if is_enabled is not None:
            state.is_enabled = 1 if is_enabled else 0
        if threshold_days is not None:
            state.threshold_days = max(1, threshold_days)
        state.updated_at = now_iso()
        self.session.flush()
        return state

    def list_all(self) -> list[WorkerState]:
        return list(self.session.scalars(select(WorkerState).order_by(WorkerState.name.asc())))
