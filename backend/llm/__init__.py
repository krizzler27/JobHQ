"""Local SLM prompt catalog, download manager, and llama-cpp-python runtime."""

from backend.llm.downloader import DOWNLOAD_MANAGER, ModelDownloadManager, get_models_dir, list_downloaded_models
from backend.llm.prompts import RECOMMENDED_SLMS, SlmPromptBuilder, extract_json_object
from backend.llm.runtime import (
    LlamaCppPythonAdapter,
    LocalLlmProvider,
    get_llm_adapter,
    get_llm_status,
    get_optimal_cpu_threads,
    is_llama_cpp_installed,
    test_llm_engine,
)

__all__ = [
    "RECOMMENDED_SLMS",
    "DOWNLOAD_MANAGER",
    "ModelDownloadManager",
    "SlmPromptBuilder",
    "LlamaCppPythonAdapter",
    "LocalLlmProvider",
    "get_models_dir",
    "list_downloaded_models",
    "extract_json_object",
    "get_optimal_cpu_threads",
    "is_llama_cpp_installed",
    "get_llm_adapter",
    "get_llm_status",
    "test_llm_engine",
]
