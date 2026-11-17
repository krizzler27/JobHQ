"""User home directory and application storage path management for JobHQ."""

import os
from pathlib import Path


def get_jobhq_home_dir() -> str:
    """Returns the central JobHQ user home directory (~/.jobhq or JOBHQ_HOME).

    Can be overridden via the JOBHQ_HOME environment variable.
    Falls back gracefully to ./data if the user home directory is restricted.
    """
    env_dir = os.environ.get("JOBHQ_HOME")
    if env_dir and env_dir.strip():
        target = os.path.abspath(env_dir.strip())
    else:
        target = os.path.join(Path.home(), ".jobhq")

    try:
        os.makedirs(target, exist_ok=True)
    except (PermissionError, OSError):
        # Fallback to local workspace data directory if home is write-restricted
        target = os.path.join(os.getcwd(), "data")
        os.makedirs(target, exist_ok=True)

    return target


def get_default_db_path() -> str:
    """Returns the default SQLite database path (~/.jobhq/data/job_tracker.db)."""
    env_db = os.environ.get("JOBHQ_DB_PATH")
    if env_db and env_db.strip():
        return os.path.abspath(env_db.strip())

    base = get_jobhq_home_dir()
    if base.endswith("data"):
        return os.path.join(base, "job_tracker.db")

    data_dir = os.path.join(base, "data")
    try:
        os.makedirs(data_dir, exist_ok=True)
    except (PermissionError, OSError):
        data_dir = os.path.join(os.getcwd(), "data")
        os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "job_tracker.db")


def get_default_backups_dir() -> str:
    """Returns the default backups directory (~/.jobhq/backups)."""
    env_backups = os.environ.get("JOBHQ_BACKUPS_DIR")
    if env_backups and env_backups.strip():
        return os.path.abspath(env_backups.strip())

    base = get_jobhq_home_dir()
    if base.endswith("data"):
        backups_dir = os.path.join(os.path.dirname(base), "data", "backups")
    else:
        backups_dir = os.path.join(base, "backups")

    try:
        os.makedirs(backups_dir, exist_ok=True)
    except (PermissionError, OSError):
        backups_dir = os.path.join(os.getcwd(), "data", "backups")
        os.makedirs(backups_dir, exist_ok=True)
    return backups_dir
