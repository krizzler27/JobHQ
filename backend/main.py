"""FastAPI application factory, lifecycle wiring, and Uvicorn entrypoint."""

import os
import sys
from contextlib import asynccontextmanager

# Allow running directly as `python backend/main.py` in addition to `python -m backend`
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.deps import DEFAULT_APP_CONTEXT, AppContext, get_app_context
from backend.api.routers.registry import register_routers
from backend.core.config import config
from backend.core.logging import setup_logging

logger = setup_logging("jobhq.api")


def create_app(context: AppContext | None = None) -> FastAPI:
    app_ctx = context or get_app_context()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        app_ctx.db.init_schema()
        yield

    application = FastAPI(title="JobHQ API", lifespan=lifespan)
    # Enable CORS for Tauri desktop webview custom protocol origins and local dev servers
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://tauri.localhost",
            "https://tauri.localhost",
            "tauri://localhost",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_private_network=True,
    )
    if context is not None:
        application.dependency_overrides[get_app_context] = lambda: app_ctx

    @application.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})

    register_routers(application)
    return application


app = create_app()


def main() -> None:
    uvicorn.run(app, host=config.host, port=config.port, log_level="info")


if __name__ == "__main__":
    main()
