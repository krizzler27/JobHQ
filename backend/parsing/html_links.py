"""HTML-to-text conversion, link extraction, noise filtering, and job-link ranking."""

import html
import re
from html.parser import HTMLParser


def tokenize_text(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9+#.]{2,}", text.lower())
    stop = {"and", "the", "for", "with", "at", "in", "of", "to", "a", "an", "or", "on"}
    return {w for w in words if w not in stop}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._links: list[str] = []
        self._link_items: list[tuple[str, str]] = []
        self._active_href: str | None = None
        self._active_link_text: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        if t in ("script", "style", "head"):
            self._skip_depth += 1
            return
        if t in ("br", "p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section"):
            self._chunks.append("\n")
        if t == "a":
            for k, v in attrs:
                if k.lower() == "href" and v:
                    href = v.strip()
                    if href.startswith(("http://", "https://")):
                        self._links.append(href)
                        self._active_href = href
                        self._active_link_text = []
                    break

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t in ("script", "style", "head") and self._skip_depth > 0:
            self._skip_depth -= 1
            return
        if t == "a" and self._active_href:
            anchor = html.unescape(re.sub(r"\s+", " ", "".join(self._active_link_text))).strip()
            self._link_items.append((self._active_href, anchor[:200]))
            self._active_href = None
            self._active_link_text = []
        if t in ("p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"):
            self._chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            self._chunks.append(data)
            if self._active_href is not None:
                self._active_link_text.append(data)

    def get_text(self) -> str:
        raw = html.unescape("".join(self._chunks))
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in raw.splitlines()]
        return "\n".join(line for line in lines if line)

    def get_links(self) -> list[str]:
        return self._links

    def get_link_items(self) -> list[tuple[str, str]]:
        return self._link_items


def html_to_text_and_links(raw_html: str) -> tuple[str, list[str]]:
    p = _TextExtractor()
    p.feed(raw_html)
    p.close()
    return p.get_text(), p.get_links()


def html_to_text_links_rich(raw_html: str) -> tuple[str, list[tuple[str, str]]]:
    p = _TextExtractor()
    p.feed(raw_html)
    p.close()
    return p.get_text(), p.get_link_items()


LINK_NOISE_PATTERNS = (
    "unsubscribe",
    "optout",
    "opt-out",
    "email-preferences",
    "manage-alert",
    "manage_alert",
    "manage alert",
    "edit alert",
    "privacy",
    "terms-of-service",
    "terms of service",
    "terms-and-conditions",
    "cookie",
    "help.",
    "/help",
    "support.",
    "feedback",
    "pixel",
    "facebook.com",
    "twitter.com",
    "x.com/",
    "instagram.com",
    "youtube.com",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".css",
    ".ico",
)


def is_noise_link(url: str, anchor: str = "") -> bool:
    u_low = url.lower().strip()
    a_low = anchor.lower().strip()
    if not u_low.startswith(("http://", "https://")):
        return True
    return any(p in u_low or p in a_low for p in LINK_NOISE_PATTERNS)


def extract_plain_text_link_items(body: str) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    seen: set[str] = set()
    for line in (body or "").splitlines():
        urls = re.findall(r"https?://[^\s<>\"')\]]+", line)
        if not urls:
            continue
        ctx = re.sub(r"https?://[^\s<>\"')\]]+", "", line).strip(" -:|[]()<>")
        for raw_u in urls:
            u = raw_u.rstrip(".,;:!?")
            if u and u not in seen:
                seen.add(u)
                items.append((u, ctx[:160]))
    return items


def merge_link_items(
    html_items: list[tuple[str, str]] | None, body: str
) -> list[tuple[str, str]]:
    merged: list[tuple[str, str]] = []
    seen: set[str] = set()
    for u, a in list(html_items or []) + extract_plain_text_link_items(body):
        clean_u = str(u or "").strip()
        if not clean_u or clean_u in seen or is_noise_link(clean_u, a):
            continue
        seen.add(clean_u)
        merged.append((clean_u, str(a or "").strip()))
    return merged


def pick_application_link(
    link_items: list[tuple[str, str]], company: str = "", role: str = ""
) -> str:
    if not link_items:
        return ""
    comp_low = company.strip().lower()
    role_tokens = tokenize_text(role) if role else set()
    best_url = ""
    best_score = -999

    ats_or_job_hints = (
        "greenhouse.io",
        "lever.co",
        "ashbyhq.com",
        "myworkdayjobs.com",
        "workday.com",
        "smartrecruiters.com",
        "icims.com",
        "jobvite.com",
        "rippling.com",
        "bamboohr.com",
        "hackerrank.com",
        "codesignal.com",
        "codility.com",
        "coderpad.io",
        "linkedin.com/jobs",
        "linkedin.com/comm/jobs",
        "indeed.com/viewjob",
        "wellfound.com/jobs",
        "/jobs/",
        "/job/",
        "/careers",
        "/apply",
        "/application",
        "/candidate",
        "/assessment",
    )
    anchor_hints = (
        "view application",
        "application status",
        "check status",
        "candidate portal",
        "portal",
        "view job",
        "job posting",
        "job description",
        "assessment",
        "coding challenge",
        "take-home",
        "apply",
        "track application",
    )

    for url, anchor in link_items:
        u_low = url.lower()
        a_low = anchor.lower()
        sc = 0
        if any(h in a_low for h in anchor_hints):
            sc += 50
        if any(h in u_low for h in ats_or_job_hints):
            sc += 35
        if comp_low and len(comp_low) >= 3 and comp_low not in ("unknown", "unknown company"):
            if comp_low in u_low or comp_low in a_low:
                sc += 25
        if role_tokens and anchor:
            overlap = len(role_tokens & tokenize_text(anchor)) / max(len(role_tokens), 1)
            if overlap >= 0.4:
                sc += 35
        path_part = re.sub(r"^https?://[^/]+", "", u_low).strip("/")
        if not path_part:
            sc -= 30
        if sc > best_score:
            best_score = sc
            best_url = url

    return best_url if best_score >= 15 else ""


def match_job_alert_link(
    job_title: str,
    company_name: str,
    link_items: list[tuple[str, str]],
) -> str:
    if not link_items:
        return ""
    title_low = job_title.strip().lower()
    title_tokens = tokenize_text(job_title)
    comp_low = company_name.strip().lower()

    best_url = ""
    best_score = -1

    job_url_hints = (
        "/jobs/view",
        "/comm/jobs/view",
        "viewjob",
        "/rc/clk",
        "/job/",
        "/jobs/",
        "/careers/",
        "/position",
        "greenhouse.io",
        "lever.co",
        "ashbyhq.com",
        "wellfound.com",
        "workatastartup.com",
        "otta.com",
        "welcometothejungle.com",
        "builtin.com",
        "dice.com",
        "naukri.com",
        "instahyre.com",
        "hirist.tech",
        "hirist.com",
        "foundit.in",
        "glassdoor.com/job-listing",
    )

    for url, anchor in link_items:
        u_low = url.lower()
        a_low = anchor.lower().strip()
        sc = 0

        if title_low and a_low:
            if title_low in a_low or (len(a_low) >= 5 and a_low in title_low):
                sc += 100
            elif title_tokens:
                a_tokens = tokenize_text(a_low)
                if a_tokens:
                    overlap = len(title_tokens & a_tokens) / max(len(title_tokens), 1)
                    if overlap >= 0.5:
                        sc += int(45 + overlap * 45)

        if comp_low and len(comp_low) >= 3 and (comp_low in a_low or comp_low in u_low):
            sc += 20

        if any(h in u_low for h in job_url_hints):
            sc += 20

        if any(w in a_low for w in ("view job", "apply now", "see job", "view role", "apply")):
            sc += 15

        if any(w in a_low for w in ("view all jobs", "see all jobs", "see more jobs", "job alert settings")):
            sc -= 25

        if sc > best_score:
            best_score = sc
            best_url = url

    return best_url if best_score >= 20 else ""
