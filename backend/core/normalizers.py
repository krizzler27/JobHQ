"""Shared text, company name, HTTP URL, and ISO date normalization helpers."""

import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_CORP_SUFFIX_RE = re.compile(
    r"\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|pvt|private|plc|gmbh)\b"
)
_TRACKING_QUERY_PREFIXES = ("utm_", "trk", "ref", "fbclid", "gclid", "mc_", "referrer", "source")


def clean_http_url(raw: Any) -> str:
    val = str(raw or "").strip()
    if val.startswith(("http://", "https://")) and len(val) <= 2000:
        return val
    return ""


def normalize_match_text(raw: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(raw or "").lower()).strip()


def normalize_company(raw: Any) -> str:
    base = normalize_match_text(raw)
    if not base:
        return ""
    stripped = re.sub(r"\s+", " ", _CORP_SUFFIX_RE.sub("", base)).strip()
    return stripped or base


def normalize_url_key(raw: Any) -> str:
    clean = clean_http_url(raw)
    if not clean:
        return ""
    try:
        parts = urlsplit(clean)
    except Exception:
        return clean.lower()
    host = parts.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = parts.path.rstrip("/")
    kept_params = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=False)
        if not any(k.lower().startswith(p) for p in _TRACKING_QUERY_PREFIXES)
    ]
    kept_params.sort()
    query = urlencode(kept_params)
    return urlunsplit(("", host, path, query, "")).lstrip("/")


def parse_iso_date(raw: Any) -> datetime | None:
    s = str(raw or "").strip()
    if len(s) < 10:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def normalize_text(text: str) -> str:
    if not text:
        return ""
    return (
        text.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u02bc", "'")
        .replace("\u2032", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2013", "-")
        .replace("\u2014", "-")
    )
