"""Background GGUF model download manager and local ./models directory scanner."""

import os
import threading
import urllib.request
from typing import Callable

from backend.llm.prompts import RECOMMENDED_SLMS


def get_models_dir() -> str:
    return os.path.join(os.getcwd(), "models")


def list_downloaded_models() -> list[dict]:
    models_dir = get_models_dir()
    if not os.path.isdir(models_dir):
        return []
    found: list[dict] = []
    for entry in sorted(os.listdir(models_dir)):
        if entry.lower().endswith(".gguf"):
            full = os.path.join(models_dir, entry)
            if os.path.isfile(full):
                size_mb = round(os.path.getsize(full) / (1024 * 1024))
                found.append(
                    {
                        "filename": entry,
                        "path": f"./models/{entry}",
                        "size_mb": size_mb,
                    }
                )
    return found


class ModelDownloadManager:
    """Downloads a recommended GGUF model into ./models/ in the background."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: dict = {
            "status": "idle",
            "model_id": "",
            "filename": "",
            "path": "",
            "downloaded_mb": 0.0,
            "total_mb": 0.0,
            "percent": 0,
            "error": "",
        }

    def get_status(self) -> dict:
        with self._lock:
            return {
                **self._state,
                "downloaded_models": list_downloaded_models(),
            }

    def start_download(
        self, model_id: str, on_complete: Callable[[str], None] | None = None
    ) -> dict:
        spec = next((m for m in RECOMMENDED_SLMS if m["id"] == model_id), None)
        if not spec:
            raise ValueError("Selected model was not found.")

        models_dir = get_models_dir()
        os.makedirs(models_dir, exist_ok=True)
        final_path = os.path.join(models_dir, spec["filename"])
        rel_path = f"./models/{spec['filename']}"

        if os.path.isfile(final_path) and os.path.getsize(final_path) > 10_000_000:
            if on_complete:
                on_complete(rel_path)
            with self._lock:
                self._state = {
                    "status": "completed",
                    "model_id": model_id,
                    "filename": spec["filename"],
                    "path": rel_path,
                    "downloaded_mb": round(os.path.getsize(final_path) / (1024 * 1024), 1),
                    "total_mb": round(os.path.getsize(final_path) / (1024 * 1024), 1),
                    "percent": 100,
                    "error": "",
                }
            return self.get_status()

        with self._lock:
            if self._state["status"] == "downloading":
                return {**self._state, "downloaded_models": list_downloaded_models()}
            self._state = {
                "status": "downloading",
                "model_id": model_id,
                "filename": spec["filename"],
                "path": rel_path,
                "downloaded_mb": 0.0,
                "total_mb": 0.0,
                "percent": 0,
                "error": "",
            }

        thread = threading.Thread(
            target=self._run_download,
            args=(spec, final_path, rel_path, on_complete),
            daemon=True,
        )
        thread.start()
        return self.get_status()

    def _run_download(
        self,
        spec: dict,
        final_path: str,
        rel_path: str,
        on_complete: Callable[[str], None] | None,
    ) -> None:
        part_path = f"{final_path}.part"
        try:
            req = urllib.request.Request(
                spec["download_url"],
                headers={"User-Agent": "JobTracker/1.0"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                total_bytes = int(resp.headers.get("Content-Length", "0") or "0")
                downloaded = 0
                with open(part_path, "wb") as f:
                    while True:
                        chunk = resp.read(1024 * 1024)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        pct = (
                            min(99, int((downloaded / total_bytes) * 100))
                            if total_bytes > 0
                            else 0
                        )
                        with self._lock:
                            self._state["downloaded_mb"] = round(downloaded / (1024 * 1024), 1)
                            self._state["total_mb"] = round(total_bytes / (1024 * 1024), 1)
                            self._state["percent"] = pct

            os.replace(part_path, final_path)
            if on_complete:
                on_complete(rel_path)
            with self._lock:
                self._state["status"] = "completed"
                self._state["percent"] = 100
        except Exception as exc:
            if os.path.exists(part_path):
                try:
                    os.remove(part_path)
                except OSError:
                    pass
            with self._lock:
                self._state["status"] = "error"
                self._state["error"] = f"Download failed: {exc}"


DOWNLOAD_MANAGER = ModelDownloadManager()
