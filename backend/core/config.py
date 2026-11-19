
"""Centralized, strongly-typed configuration and path management for JobHQ."""

from functools import lru_cache
from pathlib import Path
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class JobHQConfig(BaseSettings):
    """Unified runtime configuration for JobHQ desktop and API services."""

    model_config = SettingsConfigDict(
        env_prefix="JOBHQ_",
        env_file=".env",
        extra="ignore",
    )

    # Core Directories & Files (clean ~/.jobhq defaults)
    home_dir: Path = Field(
        default_factory=lambda: Path.home() / ".jobhq",
        description="Central JobHQ home directory (~/.jobhq).",
    )
    custom_db_path: Path | None = Field(
        default=None,
        validation_alias=AliasChoices("JOBHQ_DB_PATH", "DB_PATH"),
        description="Optional override for database path.",
    )
    custom_backups_dir: Path | None = Field(
        default=None,
        validation_alias=AliasChoices("JOBHQ_BACKUPS_DIR", "BACKUPS_DIR"),
        description="Optional override for backups directory.",
    )
    custom_models_dir: Path | None = Field(
        default=None,
        validation_alias=AliasChoices("JOBHQ_MODELS_DIR", "MODELS_DIR"),
        description="Optional override for models directory.",
    )
    custom_secret_key_path: Path | None = Field(
        default=None,
        validation_alias=AliasChoices("JOBHQ_SECRET_KEY_PATH", "SECRET_KEY_PATH"),
        description="Optional override for secret key path.",
    )

    # Server, Cryptography & Logging
    host: str = Field(
        default="127.0.0.1",
        validation_alias=AliasChoices("JOBHQ_HOST", "HOST"),
        description="FastAPI server loopback binding address (default 127.0.0.1).",
    )
    port: int = Field(
        default=3001,
        validation_alias=AliasChoices("JOBHQ_PORT", "PY_BACKEND_PORT"),
        description="FastAPI server port (default 3001).",
    )
    encryption_key: str = Field(
        default="",
        validation_alias=AliasChoices("JOBHQ_ENCRYPTION_KEY", "JOB_TRACKER_KEY"),
        description="Optional master symmetric Fernet key for encrypting credentials.",
    )
    log_level: str = Field(
        default="INFO",
        description="Logging level (default INFO).",
    )

    @property
    def data_dir(self) -> Path:
        """Data directory containing SQLite database (~/.jobhq/data)."""
        d = self.home_dir / "data"
        try:
            d.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass
        return d

    @property
    def db_path(self) -> Path:
        """SQLite database path (~/.jobhq/data/job_tracker.db)."""
        if self.custom_db_path:
            try:
                self.custom_db_path.parent.mkdir(parents=True, exist_ok=True)
            except OSError:
                pass
            return self.custom_db_path
        return self.data_dir / "job_tracker.db"

    @property
    def backups_dir(self) -> Path:
        """Backups directory (~/.jobhq/backups)."""
        d = self.custom_backups_dir or (self.home_dir / "backups")
        try:
            d.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass
        return d

    @property
    def models_dir(self) -> Path:
        """Directory for downloaded GGUF models (~/.jobhq/models)."""
        d = self.custom_models_dir or (self.home_dir / "models")
        try:
            d.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass
        return d

    @property
    def secret_key_path(self) -> Path:
        """Fernet secret key path (~/.jobhq/.secret.key)."""
        if self.custom_secret_key_path:
            try:
                self.custom_secret_key_path.parent.mkdir(parents=True, exist_ok=True)
            except OSError:
                pass
            return self.custom_secret_key_path
        try:
            self.home_dir.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass
        return self.home_dir / ".secret.key"


@lru_cache()
def get_config() -> JobHQConfig:
    """Returns singleton cached instance of JobHQConfig."""
    return JobHQConfig()


# Global singleton instance for direct, clean imports: from backend.core.config import config
config: JobHQConfig = get_config()
