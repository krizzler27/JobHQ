"""Desktop application single-entrypoint for JobHQ.

Runs the FastAPI web server and background worker runner in unified cooperative threads,
enabling a single standalone binary sidecar for Tauri.
"""

import logging
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
from backend.main import create_app
from backend.workers.core.registry import get_default_workers
from backend.workers.core.runner import WorkerRunner
from backend.api.deps import get_app_context


def run_worker_thread(runner: WorkerRunner, stop_event: threading.Event) -> None:
    logging.info("[desktop] Background worker thread started (15s tick loop).")
    while not stop_event.is_set():
        try:
            runner.run_tick()
        except Exception as err:
            logging.error(f"[desktop] Error in worker tick: {err}", exc_info=True)
        # Sleep with 1-second interruptible steps
        for _ in range(15):
            if stop_event.is_set():
                break
            time.sleep(1)
    logging.info("[desktop] Background worker thread stopped.")


def main() -> None:
    logging.basicConfig(
        level=getattr(logging, config.log_level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
        force=True,
    )
    logging.info(f"[desktop] Starting JobHQ unified desktop backend on port {config.port}...")

    ctx = get_app_context()
    
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
        access_log=False,
    )
    server = uvicorn.Server(uvicorn_config)

    try:
        server.run()
    finally:
        logging.info("[desktop] Shutting down worker thread...")
        stop_event.set()
        worker_thread.join(timeout=2.0)
        logging.info("[desktop] Shutdown complete.")


if __name__ == "__main__":
    main()
