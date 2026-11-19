"""Desktop application single-entrypoint for JobHQ.

Runs the FastAPI web server and background worker runner in unified background threads,
enabling a single standalone binary sidecar for Tauri.
"""

import logging
import os
import sys
import threading
import time

# Ensure project root is in sys.path
_ROOT = os.path.dirname(os.path.abspath(__file__))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import uvicorn
from backend.core.config import config
from backend.main import create_app
from backend.workers.core.runner import WorkerRunner
from backend.api.deps import get_app_context


def run_worker_thread(runner: WorkerRunner, stop_event: threading.Event) -> None:
    logging.info("[desktop_entry] Background worker thread started (15s tick loop).")
    while not stop_event.is_set():
        try:
            runner.run_tick()
        except Exception as err:
            logging.error(f"[desktop_entry] Error in worker tick: {err}", exc_info=True)
        # Sleep with 1-second interruptible steps
        for _ in range(15):
            if stop_event.is_set():
                break
            time.sleep(1)
    logging.info("[desktop_entry] Background worker thread stopped.")


def main() -> None:
    logging.basicConfig(
        level=getattr(logging, config.log_level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
        force=True,
    )
    logging.info(f"[desktop_entry] Starting JobHQ unified desktop backend on port {config.port}...")

    ctx = get_app_context()
    
    # Initialize background worker runner with default registered workers
    from backend.workers.__main__ import get_default_workers
    workers = get_default_workers(ctx)
    runner = WorkerRunner(workers, db_manager=ctx.db)

    stop_event = threading.Event()
    worker_thread = threading.Thread(
        target=run_worker_thread,
        args=(runner, stop_event),
        daemon=True,
        name="JobHQ-Worker-Thread",
    )
    worker_thread.start()

    # Create FastAPI app
    app = create_app(context=ctx)

    try:
        uvicorn_config = uvicorn.Config(
            app=app,
            host="127.0.0.1",
            port=config.port,
            log_level="info",
            access_log=False,
        )
        server = uvicorn.Server(uvicorn_config)
        server.run()
    finally:
        logging.info("[desktop_entry] Shutting down worker thread...")
        stop_event.set()
        worker_thread.join(timeout=3)
        logging.info("[desktop_entry] JobHQ desktop backend exited cleanly.")


if __name__ == "__main__":
    main()
