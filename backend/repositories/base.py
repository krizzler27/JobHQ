"""Generic DRY repository base for primary-key lookup and deletion."""

from typing import Generic, TypeVar

from sqlalchemy.orm import Session

from backend.core.models import Application, Interview, JobAlert

T = TypeVar("T", Application, Interview, JobAlert)


class BaseRepository(Generic[T]):
    model_cls: type[T]

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, entity_id: int) -> T | None:
        return self.session.get(self.model_cls, entity_id)

    def delete(self, entity_id: int) -> bool:
        obj = self.get(entity_id)
        if not obj:
            return False
        self.session.delete(obj)
        self.session.flush()
        return True
