"""Desktop application single-entrypoint for JobHQ.

Runs the FastAPI web server and background worker runner in unified cooperative threads,
enabling a single standalone binary sidecar for Tauri.
"""

import logging
import multiprocessing
import os
import sys
import threading
import time

# Ensure project root is in sys.path
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import uvicorn
from backend.core.config import config
from backend.core.logging import setup_logging
from backend.main import create_app
from backend.workers.core.registry import get_default_workers
from backend.workers.core.runner import WorkerRunner
from backend.api.deps import get_app_context

logger = setup_logging("jobhq.desktop")


def run_worker_thread(runner: WorkerRunner, stop_event: threading.Event) -> None:
    logger.info("Background worker thread started (15s tick loop).")
    while not stop_event.is_set():
        try:
            runner.run_tick()
        except Exception as err:
            logger.error(f"Error in worker tick: {err}", exc_info=True)
        # Sleep with 1-second interruptible steps
        for _ in range(15):
            if stop_event.is_set():
                break
            time.sleep(1)
    logger.info("Background worker thread stopped.")


def main() -> None:
    logger.info(f"Starting JobHQ unified desktop backend on port {config.port}...")

    # Attach logger handlers to uvicorn loggers so startup/bind errors appear in jobhq.log
    for uvicorn_log_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        u_logger = logging.getLogger(uvicorn_log_name)
        u_logger.handlers = list(logger.handlers)
        u_logger.setLevel(logger.level)
        u_logger.propagate = False

    ctx = get_app_context()
    # Initialize schema once at startup before starting worker thread or uvicorn
    ctx.db.init_schema()
    
    # Initialize background worker runner with default registered workers
    workers = get_default_workers(db=ctx.db, sync_jobs=ctx.sync_job_manager)
    runner = WorkerRunner(workers=workers, db=ctx.db)

    stop_event = threading.Event()
    worker_thread = threading.Thread(
        target=run_worker_thread,
        args=(runner, stop_event),
        name="JobHQ-WorkerRunner",
        daemon=True,
    )
    worker_thread.start()

    fastapi_app = create_app()

    uvicorn_config = uvicorn.Config(
        app=fastapi_app,
        host=config.host,
        port=config.port,
        log_level=config.log_level.lower(),
        log_config=None,
        access_log=False,
    )
    server = uvicorn.Server(uvicorn_config)

    try:
        server.run()
        logger.info(
            f"server.run() returned cleanly. started={server.started}, should_exit={server.should_exit}, force_exit={server.force_exit}"
        )
    except BaseException as exc:
        logger.error(
            f"server.run() exited with exception: {type(exc).__name__}: {exc} (started={server.started}, should_exit={server.should_exit})",
            exc_info=True,
        )
        raise
    finally:
        logger.info("Shutting down worker thread...")
        stop_event.set()
        worker_thread.join(timeout=2.0)
        logger.info("Shutdown complete.")


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
