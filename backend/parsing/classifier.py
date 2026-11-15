"""Platform detection, header pre-filtering, and rule-based email category classification."""

import re

from backend.core.constants import (
    DEFAULT_SCAN_EXCLUDE_KEYWORDS,
    DEFAULT_SCAN_SENDER_KEYWORDS,
    DEFAULT_SCAN_SUBJECT_KEYWORDS,
)
from backend.core.normalizers import normalize_text

PLATFORM_DOMAINS = [
    ("linkedin.com", "LinkedIn"),
    ("indeed.com", "Indeed"),
    ("wellfound.com", "Wellfound"),
    ("angel.co", "Wellfound"),
    ("glassdoor.com", "Glassdoor"),
    ("ziprecruiter.com", "ZipRecruiter"),
    ("otta.com", "Otta"),
    ("welcometothejungle.com", "Otta"),
    ("builtin.com", "Built In"),
    ("dice.com", "Dice"),
    ("monster.com", "Monster"),
    ("simplyhired.com", "SimplyHired"),
    ("hired.com", "Hired"),
    ("workatastartup.com", "YC Work at a Startup"),
    ("greenhouse.io", "Greenhouse"),
    ("lever.co", "Lever"),
    ("ashbyhq.com", "Ashby"),
    ("myworkdayjobs.com", "Workday"),
    ("workday.com", "Workday"),
    ("smartrecruiters.com", "SmartRecruiters"),
    ("icims.com", "iCIMS"),
    ("jobvite.com", "Jobvite"),
    ("rippling.com", "Rippling"),
    ("naukri.com", "Naukri"),
    ("instahyre.com", "Instahyre"),
    ("hirist.tech", "Hirist"),
    ("hirist.com", "Hirist"),
    ("foundit.in", "Foundit"),
    ("oracle.com", "Oracle Recruiting"),
    ("oraclecloud.com", "Oracle Recruiting"),
    ("taleo.net", "Taleo"),
    ("successfactors.com", "SuccessFactors"),
]

STRONG_APP_PHRASES: tuple[str, ...] = (
    "thank you for applying",
    "thanks for applying",
    "application received",
    "we received your application",
    "received your application",
    "your application to",
    "your application for",
    "your application status",
    "job application status",
    "application status",
    "application update",
    "update on your application",
    "application was sent",
    "application has been sent",
    "application submitted",
    "application was submitted",
    "application was viewed",
    "viewed your application",
    "check your application",
    "withdraw your application",
    "coding assessment",
    "online assessment",
    "take-home",
    "pleased to offer",
    "offer of employment",
    "job offer",
)

STRONG_REJECTION_PHRASES: tuple[str, ...] = (
    "not moving forward",
    "not move forward",
    "won't be moving forward",
    "will not be moving forward",
    "decided not to move forward",
    "unable to move forward",
    "isn't progressing",
    "is not progressing",
    "not progressing",
    "not advancing",
    "chosen not to advance",
    "other candidates",
    "another candidate",
    "sorry to inform",
    "regret to inform",
    "not selected",
    "not successful",
    "was not successful",
    "position has been filled",
    "role has been filled",
)

ALERT_SENDER_HINTS: tuple[str, ...] = (
    "jobalerts",
    "job-alerts",
    "jobs-noreply",
    "jobsearch",
    "career-alerts",
    "dailyjobs",
)

ALERT_SUBJECT_HINTS: tuple[str, ...] = (
    "job alert",
    "jobs alert",
    "new jobs",
    "jobs for you",
    "jobs matching",
    "recommended jobs",
    "jobs you might be interested",
    "jobs based on",
    "similar jobs",
    "new openings",
    "job recommendations",
    "top jobs",
    "new job postings",
    "is hiring",
    "are hiring",
)

NOISE_LINE_PATTERNS = (
    "unsubscribe",
    "manage your",
    "manage alert",
    "edit alert",
    "privacy policy",
    "terms of service",
    "terms and conditions",
    "view all jobs",
    "see all jobs",
    "see more jobs",
    "view more",
    "apply now",
    "easy apply",
    "save job",
    "copyright",
    "all rights reserved",
    "you are receiving this",
    "job alert",
    "jobs for you",
    "recommended jobs",
    "be an early applicant",
    "actively recruiting",
    "posted ",
    "ago",
    "http://",
    "https://",
    "www.",
    "help center",
    "preferences",
)

ROLE_HINT_WORDS = (
    "engineer",
    "developer",
    "architect",
    "manager",
    "designer",
    "analyst",
    "scientist",
    "specialist",
    "lead",
    "director",
    "head of",
    "vp ",
    "product",
    "devops",
    "sre",
    "frontend",
    "front-end",
    "backend",
    "back-end",
    "full stack",
    "full-stack",
    "fullstack",
    "software",
    "data",
    "machine learning",
    "ai ",
    "ml ",
    "qa ",
    "security",
    "cloud",
    "mobile",
    "ios",
    "android",
    "consultant",
    "coordinator",
    "associate",
    "intern",
    "staff",
    "principal",
    "senior",
    "junior",
    "scrum",
    "researcher",
    "administrator",
    "tester",
    "recruiter",
    "operations",
    "accountant",
    "technician",
    "strategist",
    "planner",
    "sdet",
    "sysadmin",
    "support",
    "marketing",
    "sales",
    "ux ",
    "ui/",
)


def detect_source_app(sender: str, subject: str, body: str) -> str:
    combined = f"{sender}\n{subject}".lower()
    for domain, label in PLATFORM_DOMAINS:
        if domain in combined or label.lower() in combined:
            return label

    body_head = body[:600].lower()
    for domain, label in PLATFORM_DOMAINS:
        if domain in body_head:
            return label

    email_match = re.search(r"@([a-zA-Z0-9.-]+)", sender)
    if email_match:
        host = email_match.group(1).lower()
        parts = [
            p
            for p in host.split(".")
            if p
            not in (
                "mail",
                "email",
                "alerts",
                "noreply",
                "notify",
                "jobs",
                "mg",
                "sendgrid",
                "workflow",
                "cloud",
                "us2",
                "us1",
                "eu1",
                "com",
                "org",
                "io",
                "net",
                "co",
            )
        ]
        if parts:
            return parts[0].capitalize()
    return "Direct Alert"


def extract_sender_company(sender: str) -> str:
    display_match = re.match(r'^\s*"?([^"<]+?)"?\s*<', sender)
    if display_match:
        name = display_match.group(1).strip()
        cleaned = re.sub(
            r"\b(Human\s+Resources|Talent\s+Acquisition|People\s+Operations|Recruiting|Talent|Careers|Hiring|Team|HR|Jobs|Notifications|No-?Reply|via\s+\w+)\b",
            "",
            name,
            flags=re.IGNORECASE,
        ).strip(" -|:,")
        if cleaned and len(cleaned) > 1 and not any(
            p in cleaned.lower()
            for p in (
                "linkedin",
                "indeed",
                "greenhouse",
                "lever",
                "workday",
                "ashby",
                "wellfound",
                "glassdoor",
                "oracle",
            )
        ):
            return cleaned

    email_match = re.search(r"@([a-zA-Z0-9-]+)\.", sender)
    if email_match:
        dom = email_match.group(1).lower()
        if dom not in (
            "gmail",
            "yahoo",
            "outlook",
            "greenhouse",
            "lever",
            "ashbyhq",
            "workday",
            "myworkday",
            "linkedin",
            "indeed",
            "smartrecruiters",
            "icims",
            "jobvite",
            "rippling",
            "oracle",
            "oraclecloud",
            "taleo",
            "successfactors",
            "workflow",
        ):
            return dom.capitalize()
    return ""


def has_strong_transactional_signal(subject: str, body: str) -> bool:
    """True when subject or top of body unambiguously describes a candidate's application or interview."""
    s_low = normalize_text(subject).lower()
    b_head = normalize_text(body[:1200]).lower()
    if any(h in s_low for h in ("interview", "phone screen", "technical screen", "invitation:", "schedule a call")):
        return True
    if any(h in s_low for h in STRONG_APP_PHRASES + STRONG_REJECTION_PHRASES):
        return True
    if "your application" in s_low and any(
        w in s_low for w in ("sent", "submitted", "received", "viewed", "status", "update")
    ):
        return True
    is_alert_subject = any(h in s_low for h in ALERT_SUBJECT_HINTS) or bool(
        re.search(r"\b\d+\+?\s+new\s+jobs?\b", s_low)
    )
    if not is_alert_subject and any(h in b_head for h in STRONG_APP_PHRASES + STRONG_REJECTION_PHRASES):
        return True
    return False


def classify_email(sender: str, subject: str, body: str) -> str:
    s_low = normalize_text(subject).lower()
    sender_low = normalize_text(sender).lower()
    b_low = normalize_text(body[:2500]).lower()
    b_head = b_low[:1200]

    if any(h in s_low for h in ("interview", "phone screen", "technical screen", "invitation:", "schedule a call", "chat with")):
        return "interview"

    if any(h in s_low for h in STRONG_APP_PHRASES + STRONG_REJECTION_PHRASES):
        return "application_update"
    if "your application" in s_low and any(
        w in s_low for w in ("sent", "submitted", "received", "viewed", "status", "update")
    ):
        return "application_update"

    is_alert_subject = any(h in s_low for h in ALERT_SUBJECT_HINTS) or bool(
        re.search(r"\b\d+\+?\s+new\s+jobs?\b", s_low)
    )
    if is_alert_subject:
        return "job_alert"

    if any(h in b_head for h in STRONG_APP_PHRASES + STRONG_REJECTION_PHRASES):
        return "application_update"

    interview_hints = (
        "interview",
        "phone screen",
        "technical screen",
        "recruiter screen",
        "recruiter call",
        "schedule a call",
        "schedule your",
        "meet.google.com",
        "zoom.us/j/",
        "teams.microsoft.com",
        "calendly.com",
        "goodtime.io",
        "invitation:",
        "calendar invite",
        "availability for a call",
        "chat with our",
    )
    if any(h in b_low for h in ("interview", "phone screen", "technical screen")) and any(
        h in b_low for h in ("meet.google.com", "zoom.us", "teams.microsoft.com", "calendly.com", "time:", "when:", "date:", "pm", "am")
    ):
        return "interview"
    if any(h in b_low for h in interview_hints) and ("role" in b_low or "position" in b_low or "candidate" in b_low or "recruiter" in b_low):
        return "interview"

    if any(h in sender_low for h in ALERT_SENDER_HINTS):
        return "job_alert"

    app_hints = STRONG_APP_PHRASES + STRONG_REJECTION_PHRASES + (
        "unfortunately",
        "we're sorry",
        "unsuccessful",
    )
    if any(h in s_low or h in b_low for h in app_hints):
        return "application_update"

    return "ignored"


def get_effective_scan_filters(profile: dict | None) -> tuple[list[str], list[str], list[str]]:
    """Returns (subject_keywords, sender_keywords, exclude_keywords) from profile or defaults."""
    prof = profile or {}
    subj_raw = prof.get("scan_subject_keywords")
    sender_raw = prof.get("scan_sender_keywords")
    excl_raw = prof.get("scan_exclude_keywords")

    subj_list = (
        [str(x).strip().lower() for x in subj_raw if str(x).strip()]
        if isinstance(subj_raw, list)
        else list(DEFAULT_SCAN_SUBJECT_KEYWORDS)
    )
    sender_list = (
        [str(x).strip().lower() for x in sender_raw if str(x).strip()]
        if isinstance(sender_raw, list)
        else list(DEFAULT_SCAN_SENDER_KEYWORDS)
    )
    excl_list = (
        [str(x).strip().lower() for x in excl_raw if str(x).strip()]
        if isinstance(excl_raw, list)
        else list(DEFAULT_SCAN_EXCLUDE_KEYWORDS)
    )
    return subj_list, sender_list, excl_list


def header_matches_job_filter(
    sender: str,
    subject: str,
    thread_id: str,
    profile: dict,
    known_thread_ids: set[str] | None = None,
    active_companies: list[str] | None = None,
) -> bool:
    """Fast header-only filter run before downloading full RFC822 bodies."""
    s_low = normalize_text(sender).lower()
    subj_low = normalize_text(subject).lower()

    subj_keywords, sender_keywords, exclude_keywords = get_effective_scan_filters(profile)

    if any(ex in s_low or ex in subj_low for ex in exclude_keywords if len(ex) >= 2):
        return False

    if known_thread_ids and thread_id and thread_id in known_thread_ids:
        return True

    if any(h in s_low for h in sender_keywords):
        return True

    if any(h in subj_low for h in subj_keywords):
        return True

    for company in active_companies or []:
        comp = str(company).strip().lower()
        if len(comp) >= 3 and comp not in ("unknown", "unknown company") and (comp in s_low or comp in subj_low):
            return True

    for raw_term in (profile.get("target_titles") or []) + (profile.get("keywords") or []):
        term = str(raw_term).strip().lower()
        if len(term) >= 3 and term in subj_low:
            return True

    return False
