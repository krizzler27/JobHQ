"""Repository for user Target Role Profile, scan filters, auto-sync cron, and LLM preferences."""

import json

from sqlalchemy.orm import Session

from backend.core.constants import (
    DEFAULT_SCAN_SENDER_KEYWORDS,
    DEFAULT_SCAN_SUBJECT_KEYWORDS,
    VALID_LLM_BACKENDS,
)
from backend.core.cron import validate_cron_expression
from backend.core.models import ProfileSettings, now_iso


class ProfileRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_or_create(self) -> ProfileSettings:
        profile = self.session.get(ProfileSettings, 1)
        if not profile:
            profile = ProfileSettings(
                id=1,
                llm_backend="rules",
                llm_model_path="",
                updated_at=now_iso(),
            )
            self.session.add(profile)
            self.session.flush()
        return profile

    def update(self, payload: dict) -> ProfileSettings:
        profile = self.get_or_create()
        for key in (
            "target_titles",
            "keywords",
            "excluded_keywords",
            "preferred_locations",
            "scan_subject_keywords",
            "scan_sender_keywords",
            "scan_exclude_keywords",
        ):
            if key in payload and isinstance(payload[key], list):
                cleaned: list[str] = []
                seen: set[str] = set()
                for item in payload[key]:
                    val = str(item).strip()
                    if val and val.lower() not in seen:
                        seen.add(val.lower())
                        cleaned.append(val)
                setattr(profile, key, json.dumps(cleaned))
        if "auto_sync_enabled" in payload:
            profile.auto_sync_enabled = 1 if payload["auto_sync_enabled"] else 0
        if "auto_sync_cron" in payload:
            cron_val = " ".join(str(payload["auto_sync_cron"] or "").strip().split())
            ok, err = validate_cron_expression(cron_val)
            if not ok:
                raise ValueError(f"Invalid cron schedule: {err}")
            profile.auto_sync_cron = cron_val
        if "auto_sync_days" in payload and payload["auto_sync_days"] is not None:
            profile.auto_sync_days = max(1, min(int(payload["auto_sync_days"]), 180))
        if "onboarding_completed" in payload:
            profile.onboarding_completed = 1 if payload["onboarding_completed"] else 0
        if payload.get("llm_backend") in VALID_LLM_BACKENDS:
            profile.llm_backend = payload["llm_backend"]
        if "llm_model_path" in payload:
            profile.llm_model_path = str(payload["llm_model_path"]).strip()
        profile.updated_at = now_iso()
        self.session.flush()
        return profile

    def reset_scan_filters(self) -> ProfileSettings:
        profile = self.get_or_create()
        profile.scan_subject_keywords = json.dumps(list(DEFAULT_SCAN_SUBJECT_KEYWORDS))
        profile.scan_sender_keywords = json.dumps(list(DEFAULT_SCAN_SENDER_KEYWORDS))
        profile.scan_exclude_keywords = "[]"
        profile.updated_at = now_iso()
        self.session.flush()
        return profile

    def touch_last_sync(self) -> None:
        profile = self.get_or_create()
        profile.last_sync_at = now_iso()
        self.session.flush()
