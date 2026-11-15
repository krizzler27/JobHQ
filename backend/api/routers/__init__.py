"""Router registry attaching all domain API routers to FastAPI."""

from fastapi import FastAPI

from backend.api.routers import (
    alerts,
    applications,
    backup,
    dashboard,
    emails,
    health,
    imap,
    interviews,
    llm,
    profile,
)

ALL_ROUTERS = (
    health.router,
    dashboard.router,
    imap.router,
    applications.router,
    interviews.router,
    alerts.router,
    profile.router,
    llm.router,
    emails.router,
    backup.router,
)


def register_routers(app: FastAPI) -> None:
    for router in ALL_ROUTERS:
        app.include_router(router)
