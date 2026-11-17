"""Generic base worker contract for scheduled background tasks."""

from abc import ABC, abstractmethod
from typing import Any, Optional


class BaseWorker(ABC):
    """Abstract contract for background jobs."""

    default_interval_minutes: int = 60

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for the worker (e.g. 'auto_backup')."""
        pass

    @abstractmethod
    def is_enabled(self, *args: Any, **kwargs: Any) -> bool:
        """Checks if this worker is enabled."""
        pass

    def get_cron(self, *args: Any, **kwargs: Any) -> Optional[str]:
        """Optional 5-field Unix cron schedule string. If None, uses interval_minutes."""
        return None

    @abstractmethod
    def execute(self, *args: Any, **kwargs: Any) -> None:
        """Executes the background job routine."""
        pass
