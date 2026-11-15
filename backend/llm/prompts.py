"""Recommended GGUF catalog, CPU-tuned extraction prompts, and JSON output extraction."""

import json
import re

RECOMMENDED_SLMS = [
    {
        "id": "qwen2.5-3b",
        "name": "Qwen 2.5 (3B)",
        "filename": "qwen2.5-3b-instruct-q4_k_m.gguf",
        "size_label": "2.0 GB download",
        "ram_gb": "~2.1 GB memory",
        "best_for": "Recommended — best accuracy and speed for 8 GB laptops",
        "recommended": True,
        "download_url": "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    },
    {
        "id": "llama-3.2-3b",
        "name": "Llama 3.2 (3B)",
        "filename": "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        "size_label": "2.0 GB download",
        "ram_gb": "~2.0 GB memory",
        "best_for": "Fast everyday reading with low memory use",
        "recommended": False,
        "download_url": "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    },
    {
        "id": "gemma-3-4b",
        "name": "Gemma 3 (4B)",
        "filename": "google_gemma-3-4b-it-Q4_K_M.gguf",
        "size_label": "2.5 GB download",
        "ram_gb": "~2.8 GB memory",
        "best_for": "Best for tricky recruiter and interview emails",
        "recommended": False,
        "download_url": "https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q4_K_M.gguf",
    },
    {
        "id": "qwen2.5-1.5b",
        "name": "Qwen 2.5 (1.5B)",
        "filename": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "size_label": "1.0 GB download",
        "ram_gb": "~1.1 GB memory",
        "best_for": "Lightest option for older or slower computers",
        "recommended": False,
        "download_url": "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    },
]


class SlmPromptBuilder:
    """Builds compact, high-signal prompts tuned for small local models on CPU."""

    SYSTEM_PROMPT = (
        "You are a precise job-email parser. Output ONLY valid JSON matching the exact schema. "
        "Do not output markdown, explanations, or extra keys."
    )

    @staticmethod
    def clean_email_for_slm(body: str, max_chars: int = 700) -> str:
        lines: list[str] = []
        stop_markers = (
            "unsubscribe",
            "manage your job alerts",
            "confidentiality notice",
            "this email was sent to",
            "privacy policy",
            "view in browser",
        )
        for raw in body.splitlines():
            line = re.sub(r"\s+", " ", raw).strip()
            if not line:
                continue
            low = line.lower()
            if any(marker in low for marker in stop_markers):
                break
            lines.append(line)
            if sum(len(x) + 1 for x in lines) >= max_chars:
                break
        return "\n".join(lines)[:max_chars]

    @classmethod
    def build_extraction_messages(cls, sender: str, subject: str, body: str) -> list[dict]:
        cleaned = cls.clean_email_for_slm(body)
        user_prompt = (
            "Classify email into ONE category: application_update, interview, job_alert, or ignored.\n"
            "Rules: job_alert is ONLY for job recommendation digests listing open jobs to apply to. "
            "Application confirmations, 'application was sent/viewed', 'application status', rejections, and offers are ALWAYS application_update.\n"
            "Return JSON with exact keys:\n"
            '{"category":"","company":"","role_title":"","status":"applied|interviewing|offer|rejected|ghosted",'
            '"round_label":"","scheduled_at":"YYYY-MM-DDTHH:MM or empty","meeting_link":"","source_app":"","job_titles":[]}\n\n'
            "Example:\n"
            "From: Stripe Recruiting <talent@stripe.com>\n"
            "Subject: Interview invitation: Backend Engineer at Stripe\n"
            "Body: Join us Nov 18, 2026 at 2:00 PM PST on https://meet.google.com/abc-xyz\n"
            'Output: {"category":"interview","company":"Stripe","role_title":"Backend Engineer","status":"interviewing",'
            '"round_label":"Interview","scheduled_at":"2026-11-18T14:00","meeting_link":"https://meet.google.com/abc-xyz","source_app":"Direct","job_titles":[]}\n\n'
            "Now parse:\n"
            f"From: {sender[:120]}\n"
            f"Subject: {subject[:160]}\n"
            f"Body:\n{cleaned}"
        )
        return [
            {"role": "system", "content": cls.SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]


def extract_json_object(raw_text: str) -> dict | None:
    if not raw_text:
        return None
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except ValueError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            return None
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else None
        except ValueError:
            return None
