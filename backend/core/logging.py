"""Unified, scoped logging infrastructure for JobHQ.

Provides consistent formatting with full ISO datetime, log level, module/process scope,
and message across all execution environments (FastAPI, Worker Daemon, Desktop Sidecar).
Automatically streams to both stdout and a size-capped rotating log file (~/.jobhq/logs/jobhq.log).
"""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import sys

from backend.core.config import config

# Default format with full datetime and logger scope name
# Example: 2026-11-19 14:30:15,123 [INFO] [jobhq.api] Starting server...
LOG_FORMAT = "%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Size caps for rotating log files (5 MB per file, max 2 backups = 15 MB total disk space)
MAX_LOG_BYTES = 5 * 1024 * 1024
BACKUP_COUNT = 2


def setup_logging(scope: str = "jobhq", level: str | None = None) -> logging.Logger:
    """Configures the root logging handlers and returns a scoped logger.

    Args:
        scope: The hierarchical logger scope (e.g. 'jobhq.api', 'jobhq.workers', 'jobhq.desktop').
        level: Optional log level override; defaults to config.log_level.

    Returns:
        A configured logging.Logger instance bound to the requested scope.
    """
    effective_level_str = (level or config.log_level).upper()
    effective_level = getattr(logging, effective_level_str, logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(effective_level)

    # Avoid duplicating handlers if already configured in this process
    if not root_logger.handlers:
        formatter = logging.Formatter(fmt=LOG_FORMAT, datefmt=DATE_FORMAT)

        # 1. Console stream handler (stdout with UTF-8 / replacement fallback)
        stream = sys.stdout
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass
        console_handler = logging.StreamHandler(stream)
        console_handler.setLevel(effective_level)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

        # 2. Size-capped rotating file handler (~/.jobhq/logs/jobhq.log)
        try:
            log_path: Path = config.log_file
            log_path.parent.mkdir(parents=True, exist_ok=True)
            file_handler = RotatingFileHandler(
                filename=str(log_path),
                maxBytes=MAX_LOG_BYTES,
                backupCount=BACKUP_COUNT,
                encoding="utf-8",
            )
            file_handler.setLevel(effective_level)
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
        except (OSError, PermissionError) as err:
            # If filesystem is read-only or restricted, continue cleanly with console logging
            print(f"[logging] Warning: Could not initialize rotating log file ({err})", file=sys.stderr)

    return logging.getLogger(scope)
