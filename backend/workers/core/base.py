"""Generic base worker contract for scheduled background tasks."""

from abc import ABC, abstractmethod


class BaseWorker(ABC):
    """Abstract contract for background jobs."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for the worker (e.g. 'auto_sync')."""
        pass

    @abstractmethod
    def is_enabled(self, *args, **kwargs) -> bool:
        """Checks if this worker should run."""
        pass

    @abstractmethod
    def get_cron(self, *args, **kwargs) -> str:
        """Returns standard 5-field Unix cron schedule string."""
        pass

    @abstractmethod
    def execute(self, *args, **kwargs) -> None:
        """Executes the background job routine."""
        pass
