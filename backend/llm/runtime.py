"""Local llama-cpp-python runtime adapter, lazy loader, and RAM unloader."""

import gc
import logging
import os
import threading
from typing import Protocol

from backend.llm.downloader import list_downloaded_models
from backend.llm.prompts import SlmPromptBuilder, extract_json_object

logger = logging.getLogger("job_tracker.llm")


def get_optimal_cpu_threads() -> int:
    """Calculates a safe CPU thread count that avoids freezing low-end laptops."""
    cores = os.cpu_count() or 4
    return max(1, min(cores // 2, 6))


def is_llama_cpp_installed() -> bool:
    try:
        import llama_cpp  # type: ignore  # noqa: F401

        return True
    except ImportError:
        return False


class LocalLlmProvider(Protocol):
    def parse_email(self, sender: str, subject: str, body: str) -> dict | None:
        ...


class LlamaCppPythonAdapter:
    """Runs quantized GGUF models directly via llama-cpp-python on CPU."""

    _lock = threading.Lock()
    _cached_instance = None
    _cached_path = ""
    _cached_threads = 0

    def __init__(self, model_path: str) -> None:
        self.model_path = model_path
        self.threads = get_optimal_cpu_threads()

    def _get_llm(self):
        if not self.model_path or not os.path.isfile(self.model_path):
            return None
        if (
            LlamaCppPythonAdapter._cached_instance is not None
            and LlamaCppPythonAdapter._cached_path == self.model_path
            and LlamaCppPythonAdapter._cached_threads == self.threads
        ):
            return LlamaCppPythonAdapter._cached_instance

        if LlamaCppPythonAdapter._cached_instance is not None:
            self._release_locked()

        from llama_cpp import Llama  # type: ignore

        logger.info(
            "[llm] Loading GGUF model '%s' (n_ctx=1024, threads=%d)...",
            os.path.basename(self.model_path),
            self.threads,
        )
        llm = Llama(
            model_path=self.model_path,
            n_ctx=1024,
            n_threads=self.threads,
            n_gpu_layers=0,
            verbose=False,
        )
        LlamaCppPythonAdapter._cached_instance = llm
        LlamaCppPythonAdapter._cached_path = self.model_path
        LlamaCppPythonAdapter._cached_threads = self.threads
        return llm

    @classmethod
    def _release_locked(cls) -> bool:
        inst = cls._cached_instance
        if inst is None:
            return False
        close_fn = getattr(inst, "close", None)
        if callable(close_fn):
            try:
                close_fn()
            except Exception:
                pass
        cls._cached_instance = None
        cls._cached_path = ""
        cls._cached_threads = 0
        del inst
        gc.collect()
        logger.info("[llm] Unloaded local AI model from RAM.")
        return True

    @classmethod
    def unload(cls) -> bool:
        with cls._lock:
            return cls._release_locked()

    def parse_email(self, sender: str, subject: str, body: str) -> dict | None:
        try:
            with LlamaCppPythonAdapter._lock:
                llm = self._get_llm()
                if llm is None:
                    return None
                messages = SlmPromptBuilder.build_extraction_messages(sender, subject, body)
                out = llm.create_chat_completion(
                    messages=messages,
                    temperature=0.05,
                    max_tokens=160,
                    response_format={"type": "json_object"},
                )
            content = out.get("choices", [{}])[0].get("message", {}).get("content", "")
            return extract_json_object(content)
        except Exception as exc:
            logger.warning("[llm] Parse error for '%s': %s", subject[:60], exc)
            return None


def get_llm_adapter(backend: str, model_path: str) -> LocalLlmProvider | None:
    if backend == "llama_cpp_python":
        return LlamaCppPythonAdapter(model_path=model_path)
    return None


def get_llm_status() -> dict:
    return {
        "llama_cpp_installed": is_llama_cpp_installed(),
        "auto_cpu_threads": get_optimal_cpu_threads(),
        "downloaded_models": list_downloaded_models(),
    }


def test_llm_engine(backend: str, model_path: str) -> dict:
    if backend == "rules":
        return {
            "ok": True,
            "backend": "rules",
            "message": "Built-in reader is active and ready to scan emails right away.",
        }

    if backend == "llama_cpp_python":
        if not is_llama_cpp_installed():
            return {
                "ok": False,
                "backend": "llama_cpp_python",
                "message": (
                    "The local AI runner is not installed yet. Run install.bat (Windows), "
                    "./install.sh (Mac/Linux), or `uv sync` in the project folder."
                ),
            }
        if not model_path or not os.path.isfile(model_path):
            return {
                "ok": False,
                "backend": "llama_cpp_python",
                "message": (
                    "No model file found yet. Pick a model below and click Download, "
                    "or enter the path to an existing .gguf file."
                ),
            }
        return {
            "ok": True,
            "backend": "llama_cpp_python",
            "message": (
                f"Local AI model is ready ({os.path.basename(model_path)}). "
                f"Using {get_optimal_cpu_threads()} CPU threads automatically."
            ),
        }

    return {"ok": False, "backend": backend, "message": "Unknown email reader selected."}
