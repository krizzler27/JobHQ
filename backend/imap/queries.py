"""Provider-safe IMAP SEARCH OR-tree query builder, folder normalization, and MIME header decoding."""

import re
import unicodedata
from email.header import decode_header

from backend.core.normalizers import normalize_text
from backend.parsing.classifier import get_effective_scan_filters


def _sanitize_imap_search_term(raw: str) -> str:
    cleaned = normalize_text(str(raw or ""))
    ascii_only = unicodedata.normalize("NFKD", cleaned).encode("ascii", "ignore").decode("ascii")
    ascii_only = ascii_only.replace("\\", " ").replace('"', " ").replace("\r", " ").replace("\n", " ")
    ascii_only = re.sub(r"\s+", " ", ascii_only).strip()
    return ascii_only if len(ascii_only) >= 2 else ""


def _build_or_tree(clauses: list[str]) -> str:
    if len(clauses) == 1:
        return clauses[0]
    if len(clauses) == 2:
        return f"OR {clauses[0]} {clauses[1]}"
    return f"OR {clauses[0]} ({_build_or_tree(clauses[1:])})"


def build_imap_search_queries(
    since_date: str,
    profile: dict | None,
    active_companies: list[str] | None = None,
    chunk_size: int = 6,
) -> list[str]:
    """
    Builds provider-safe batched IMAP UID SEARCH criteria strings from editable scan keywords
    and active application companies.
    Uses small OR trees (default 6 terms per query) so Gmail, Outlook, and Yahoo handle them reliably.
    """
    subj_kw, sender_kw, _ = get_effective_scan_filters(profile)
    prof = profile or {}
    extra_subj = [
        str(x).strip().lower()
        for x in (prof.get("target_titles") or []) + (prof.get("keywords") or [])
        if len(str(x).strip()) >= 3
    ]

    clauses: list[str] = []
    seen: set[tuple[str, str]] = set()

    for term in subj_kw + extra_subj:
        safe = _sanitize_imap_search_term(term)
        if safe and ("SUBJECT", safe.lower()) not in seen:
            seen.add(("SUBJECT", safe.lower()))
            clauses.append(f'SUBJECT "{safe}"')

    for term in sender_kw:
        safe = _sanitize_imap_search_term(term)
        if safe and ("FROM", safe.lower()) not in seen:
            seen.add(("FROM", safe.lower()))
            clauses.append(f'FROM "{safe}"')

    for company in active_companies or []:
        safe = _sanitize_imap_search_term(company)
        if (
            safe
            and len(safe) >= 3
            and safe.lower() not in ("unknown", "unknown company")
            and ("FROM", safe.lower()) not in seen
        ):
            seen.add(("FROM", safe.lower()))
            clauses.append(f'FROM "{safe}"')

    if not clauses:
        return [f'(SINCE "{since_date}")']

    queries: list[str] = []
    step = max(2, chunk_size)
    for idx in range(0, len(clauses), step):
        batch = clauses[idx : idx + step]
        queries.append(f'(SINCE "{since_date}" {_build_or_tree(batch)})')
    return queries


def decode_mime_header(raw_value: str | None) -> str:
    if not raw_value:
        return ""
    parts = decode_header(raw_value)
    decoded: list[str] = []
    for chunk, charset in parts:
        if isinstance(chunk, bytes):
            enc = charset or "utf-8"
            try:
                decoded.append(chunk.decode(enc, errors="replace"))
            except LookupError:
                decoded.append(chunk.decode("utf-8", errors="replace"))
        else:
            decoded.append(chunk)
    return "".join(decoded).strip()


def parse_folder_list(raw: str | list[str] | None) -> list[str]:
    if isinstance(raw, list):
        items = [str(x).strip() for x in raw]
    else:
        items = [part.strip() for part in str(raw or "").split(",")]
    seen: set[str] = set()
    folders: list[str] = []
    for item in items:
        if item and item.lower() not in seen:
            seen.add(item.lower())
            folders.append(item)
    return folders or ["INBOX"]


def parse_imap_list_line(line: bytes | str) -> tuple[list[str], str] | None:
    text = line.decode("utf-8", errors="replace") if isinstance(line, bytes) else str(line)
    match = re.match(r'^\(([^)]*)\)\s+(?:"([^"]*)"|NIL)\s+(.+)$', text.strip())
    if not match:
        return None
    flags = [f.strip().lower() for f in match.group(1).split() if f.strip()]
    name_part = match.group(3).strip()
    if name_part.startswith('"') and name_part.endswith('"') and len(name_part) >= 2:
        name_part = name_part[1:-1].replace('\\"', '"').replace("\\\\", "\\")
    return flags, name_part
