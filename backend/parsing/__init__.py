"""HTML extraction, link filtering, email classification, field extractors, and alert scoring."""

from backend.core.constants import (
    DEFAULT_SCAN_EXCLUDE_KEYWORDS,
    DEFAULT_SCAN_SENDER_KEYWORDS,
    DEFAULT_SCAN_SUBJECT_KEYWORDS,
)
from backend.core.normalizers import normalize_text
from backend.parsing.classifier import (
    ALERT_SENDER_HINTS,
    ALERT_SUBJECT_HINTS,
    NOISE_LINE_PATTERNS,
    PLATFORM_DOMAINS,
    ROLE_HINT_WORDS,
    STRONG_APP_PHRASES,
    STRONG_REJECTION_PHRASES,
    classify_email,
    detect_source_app,
    extract_sender_company,
    get_effective_scan_filters,
    has_strong_transactional_signal,
    header_matches_job_filter,
)
from backend.parsing.extractors import (
    extract_application_info,
    extract_interview_info,
    extract_job_alert_titles,
    needs_ai_refinement,
)
from backend.parsing.html_links import (
    LINK_NOISE_PATTERNS,
    extract_plain_text_link_items,
    html_to_text_and_links,
    html_to_text_links_rich,
    is_noise_link,
    match_job_alert_link,
    merge_link_items,
    pick_application_link,
    tokenize_text,
)
from backend.parsing.scorer import score_job_title

HEADER_SENDER_HINTS = DEFAULT_SCAN_SENDER_KEYWORDS
HEADER_SUBJECT_HINTS = DEFAULT_SCAN_SUBJECT_KEYWORDS

__all__ = [
    "DEFAULT_SCAN_EXCLUDE_KEYWORDS",
    "DEFAULT_SCAN_SENDER_KEYWORDS",
    "DEFAULT_SCAN_SUBJECT_KEYWORDS",
    "HEADER_SENDER_HINTS",
    "HEADER_SUBJECT_HINTS",
    "LINK_NOISE_PATTERNS",
    "PLATFORM_DOMAINS",
    "STRONG_APP_PHRASES",
    "STRONG_REJECTION_PHRASES",
    "ALERT_SENDER_HINTS",
    "ALERT_SUBJECT_HINTS",
    "NOISE_LINE_PATTERNS",
    "ROLE_HINT_WORDS",
    "normalize_text",
    "tokenize_text",
    "html_to_text_and_links",
    "html_to_text_links_rich",
    "is_noise_link",
    "extract_plain_text_link_items",
    "merge_link_items",
    "pick_application_link",
    "match_job_alert_link",
    "detect_source_app",
    "extract_sender_company",
    "has_strong_transactional_signal",
    "classify_email",
    "get_effective_scan_filters",
    "header_matches_job_filter",
    "extract_application_info",
    "extract_interview_info",
    "extract_job_alert_titles",
    "needs_ai_refinement",
    "score_job_title",
]
