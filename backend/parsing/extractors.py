"""Structured field extractors for applications, interviews, job alerts, and AI escalation."""

import re
from datetime import datetime

from backend.core.normalizers import normalize_text
from backend.parsing.classifier import (
    NOISE_LINE_PATTERNS,
    ROLE_HINT_WORDS,
    detect_source_app,
    extract_sender_company,
)
from backend.parsing.html_links import (
    match_job_alert_link,
    merge_link_items,
    pick_application_link,
)


def extract_application_info(
    sender: str,
    subject: str,
    body: str,
    link_items: list[tuple[str, str]] | None = None,
) -> dict:
    norm_subject = normalize_text(subject)
    norm_body = normalize_text(body[:2000])
    combined = f"{norm_subject}\n{norm_body}"
    low = combined.lower()

    if any(k in low for k in ("pleased to offer", "offer of employment", "formal offer", "job offer", "excited to extend an offer")):
        status = "offer"
    elif any(
        k in low
        for k in (
            "unfortunately",
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
            "we're sorry",
            "sorry to inform",
            "not selected",
            "not successful",
            "was not successful",
            "unsuccessful",
            "position has been filled",
            "role has been filled",
            "regret to inform",
        )
    ):
        status = "rejected"
    elif any(k in low for k in ("interview", "onsite", "panel", "hiring manager")):
        status = "interviewing"
    else:
        status = "applied"

    company = ""
    role = ""

    patterns = [
        r"(?:your\s+)?application\s+(?:for\s+(?:the\s+)?(?P<role>.+?)\s+)?(?:was|has\s+been)\s+(?:sent|submitted)\s+to\s+(?P<company>[A-Z][A-Za-z0-9&.,'() -]{1,55}?)(?:\s+for\s+(?:the\s+)?(?P<role2>.+?))?(?:!|\.|\n|$)",
        r"(?:your\s+)?application\s+(?:was|has\s+been)\s+viewed\s+by\s+(?P<company>[A-Z][A-Za-z0-9&.,'() -]{1,55})(?:!|\.|\n|$)",
        r"(?:your application (?:for|to)|applied (?:for|to))\s+(?:the\s+)?(?P<role>.+?)\s+(?:at|with|@|-)\s+(?P<company>[A-Z][A-Za-z0-9&.,' ]{1,45})",
        r"(?:thank you for applying to|thanks for applying to)\s+(?P<company>[A-Z][A-Za-z0-9&.,' ]{1,45}?)(?:\s+for\s+(?:the\s+)?(?P<role>.+?))?(?:!|\.|\n|$)",
        r"(?:interview(?:\s+invitation)?|phone screen|application)\s*[:\-]\s*(?P<role>.+?)\s+(?:at|@|-)\s+(?P<company>[A-Z][A-Za-z0-9&.,' ]{1,45})",
        r"(?:your)\s+(?P<company>[A-Z][A-Za-z0-9&.,' ]{1,35}?)\s+application\b",
        r"(?P<role>[A-Z][A-Za-z0-9/+.#& ]{3,60})\s+(?:at|@)\s+(?P<company>[A-Z][A-Za-z0-9&.,' ]{1,45})",
    ]
    for pat in patterns:
        m = re.search(pat, norm_subject, flags=re.IGNORECASE) or re.search(pat, norm_body[:800], flags=re.IGNORECASE)
        if m:
            gd = m.groupdict()
            raw_role = gd.get("role") or gd.get("role2") or ""
            if raw_role:
                role = raw_role.strip(" .,:;-–—")
            if gd.get("company"):
                cand_comp = gd["company"].strip(" .,:;-–—")
                if cand_comp.lower() not in ("your", "the", "this", "a", "an", "job"):
                    company = cand_comp
            if company or role:
                break

    if not company:
        company = extract_sender_company(sender) or "Unknown Company"

    if not role:
        labeled_role = re.search(
            r"^(?:job\s+title|position\s+title|role\s+title|requisition\s+title|position|role)\s*[:\-]\s*(?P<role>[^\n]{3,90})$",
            norm_body[:1500],
            flags=re.IGNORECASE | re.MULTILINE,
        )
        if labeled_role:
            role = labeled_role.group("role").strip(" .,:;-–—")

    if not role:
        comp_low = company.lower()
        for raw_line in norm_body[:1200].splitlines()[:20]:
            line = re.sub(r"\s+", " ", raw_line).strip(" •-*|:")
            if len(line) < 5 or len(line) > 85:
                continue
            low_l = line.lower()
            if comp_low and (low_l == comp_low or low_l.startswith(f"{comp_low} ")):
                continue
            if any(n in low_l for n in NOISE_LINE_PATTERNS) or any(
                p in low_l
                for p in (
                    "your application",
                    "thank you",
                    "thanks for",
                    "applied on",
                    "view job",
                    "dear ",
                    "hi ",
                    "hello ",
                    "application status",
                    "job number",
                )
            ):
                continue
            if any(w in low_l for w in ROLE_HINT_WORDS):
                role = line
                break

    if not role:
        req_m = re.search(
            r"\b(?:job\s+number|requisition(?:\s+id|\s+number)?|req(?:\s*id|\s*#)?|job\s*id)\s*[:#]?\s*([A-Z0-9-]{4,20})\b",
            combined,
            flags=re.IGNORECASE,
        )
        cleaned_subj = re.sub(
            r"^(?:Re:|Fwd:|Update on|Thank you for applying to|Your application to|Application received:?)\s*",
            "",
            norm_subject,
            flags=re.IGNORECASE,
        ).strip(" -:|")
        if req_m and ("application status" in norm_subject.lower() or "your application" in norm_subject.lower()):
            role = f"Job #{req_m.group(1)}"
        elif re.search(r"your\s+application\s+(?:was|has\s+been)\s+(?:sent|submitted|viewed)", cleaned_subj, re.IGNORECASE):
            role = f"Application at {company}" if company and company != "Unknown Company" else "Submitted Application"
        else:
            role = cleaned_subj[:80] if cleaned_subj else "Software / Product Role"

    loc_match = re.search(
        r"\b(Remote|Hybrid|On-?site|San Francisco|New York|Seattle|Austin|London|Bangalore|Bengaluru|Toronto)\b",
        combined,
        re.IGNORECASE,
    )
    location = loc_match.group(1) if loc_match else ""

    clean_links = merge_link_items(link_items, body)
    job_url = pick_application_link(clean_links, company=company, role=role)

    return {
        "company": company[:80],
        "role_title": role[:100],
        "status": status,
        "source_platform": detect_source_app(sender, subject, body),
        "location": location,
        "job_url": job_url,
    }


def extract_interview_info(
    sender: str,
    subject: str,
    body: str,
    links: list[str],
    fallback_date: str,
    link_items: list[tuple[str, str]] | None = None,
) -> dict:
    app_info = extract_application_info(sender, subject, body, link_items=link_items)
    combined = f"{subject}\n{body[:2500]}"
    low = combined.lower()

    if "recruiter" in low or "phone screen" in low:
        round_label = "Recruiter Screen"
    elif "technical" in low or "coding" in low or "coderpad" in low:
        round_label = "Technical Interview"
    elif "system design" in low or "architecture" in low:
        round_label = "System Design"
    elif "hiring manager" in low:
        round_label = "Hiring Manager Call"
    elif "final" in low or "onsite" in low or "panel" in low:
        round_label = "Final / Panel"
    else:
        round_label = "Interview"

    meeting_link = ""
    meeting_domains = (
        "zoom.us",
        "meet.google.com",
        "teams.microsoft.com",
        "webex.com",
        "calendly.com",
        "goodtime.io",
        "coderpad.io",
        "hackerrank.com",
        "codesignal.com",
        "karat.com",
        "chime.aws",
    )
    for link in links:
        if any(d in link.lower() for d in meeting_domains):
            meeting_link = link
            break
    if not meeting_link and link_items:
        for url, anchor in link_items:
            if not any(w in url.lower() or w in anchor.lower() for w in ("unsubscribe", "privacy", "help.")) and any(
                w in anchor.lower() for w in ("join", "meeting", "video call", "schedule", "interview link")
            ):
                meeting_link = url
                break
    if not meeting_link:
        m_url = re.search(
            r"https?://(?:[\w.-]*)(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|calendly\.com)[^\s<>\"')]+",
            combined,
            re.IGNORECASE,
        )
        if m_url:
            meeting_link = m_url.group(0)

    clean_links = merge_link_items(link_items, body)
    job_links = [(u, a) for u, a in clean_links if u != meeting_link]
    job_url = pick_application_link(job_links, company=app_info["company"], role=app_info["role_title"])
    if job_url == meeting_link:
        job_url = ""

    tz_match = re.search(r"\b(PST|PDT|PT|EST|EDT|ET|CST|CDT|MST|MDT|UTC|GMT|IST|CET|BST)\b", combined)
    tz = tz_match.group(1) if tz_match else ""

    scheduled_at = ""
    date_time_patterns = [
        r"(?P<month>Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?,?\s+(?P<year>20\d{2})\s*(?:at|@|,)?\s*(?P<time>\d{1,2}:\d{2}\s*(?:AM|PM)?)",
        r"(?P<day>\d{1,2})\s+(?P<month>Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?P<year>20\d{2})\s*(?:at|@|,)?\s*(?P<time>\d{1,2}:\d{2}\s*(?:AM|PM)?)",
        r"(?P<iso>\d{4}-\d{2}-\d{2})[T\s]+(?P<time>\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)",
    ]
    for pat in date_time_patterns:
        m = re.search(pat, combined, re.IGNORECASE)
        if m:
            gd = m.groupdict()
            t_str = gd["time"].strip().upper()
            try:
                if "iso" in gd and gd["iso"]:
                    d_str = gd["iso"]
                else:
                    mon_str = gd["month"][:3].title()
                    d_obj = datetime.strptime(f"{mon_str} {int(gd['day'])} {gd['year']}", "%b %d %Y")
                    d_str = d_obj.strftime("%Y-%m-%d")
                if "AM" in t_str or "PM" in t_str:
                    t_obj = datetime.strptime(re.sub(r"\s+", " ", t_str), "%I:%M %p")
                else:
                    t_obj = datetime.strptime(t_str, "%H:%M")
                scheduled_at = f"{d_str}T{t_obj.strftime('%H:%M')}"
                break
            except Exception:
                continue

    if not scheduled_at:
        t_only = re.search(r"\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b", combined, re.IGNORECASE)
        base_day = fallback_date[:10] if len(fallback_date) >= 10 else datetime.utcnow().strftime("%Y-%m-%d")
        if t_only:
            try:
                t_obj = datetime.strptime(re.sub(r"\s+", " ", t_only.group(1).upper()), "%I:%M %p")
                scheduled_at = f"{base_day}T{t_obj.strftime('%H:%M')}"
            except Exception:
                scheduled_at = f"{base_day}T10:00"
        else:
            scheduled_at = f"{base_day}T10:00"

    interviewer_match = re.search(
        r"(?:interview\s+with|meeting\s+with|interviewer[s]?:\s*)([A-Z][a-z]+\s+[A-Z][a-z]+)",
        combined,
    )
    interviewer = interviewer_match.group(1) if interviewer_match else ""

    return {
        "company": app_info["company"],
        "role_title": app_info["role_title"],
        "round_label": round_label,
        "scheduled_at": scheduled_at,
        "timezone": tz,
        "meeting_link": meeting_link,
        "job_url": job_url,
        "interviewer_names": interviewer,
        "source_platform": app_info["source_platform"],
        "location": app_info["location"],
    }


def extract_job_alert_titles(
    subject: str,
    body: str,
    link_items: list[tuple[str, str]] | None = None,
) -> list[dict]:
    candidates: list[dict] = []
    seen: set[str] = set()
    clean_links = merge_link_items(link_items, body)

    subj_quoted = re.findall(r'["“]([^"”]{4,80})["”]', subject)
    for q in subj_quoted:
        low_q = q.lower()
        if any(w in low_q for w in ROLE_HINT_WORDS):
            key = low_q.strip()
            if key not in seen:
                seen.add(key)
                candidates.append(
                    {
                        "job_title": q.strip(),
                        "company_name": "",
                        "job_url": match_job_alert_link(q.strip(), "", clean_links),
                    }
                )

    for raw_line in body.splitlines():
        line = re.sub(r"^[•\-\*\d.)\s]+", "", raw_line).strip()
        if len(line) < 5 or len(line) > 110:
            continue
        low = line.lower()
        if any(noise in low for noise in NOISE_LINE_PATTERNS):
            continue
        if re.match(r"^[\$\€\£\d,\s\-kK/]+(?:year|yr|hr|hour|month)?$", line, re.IGNORECASE):
            continue
        if low.startswith(("hi ", "hello ", "dear ", "new jobs", "based on your")):
            continue

        has_role_word = any(w in low for w in ROLE_HINT_WORDS)
        at_match = re.match(r"^(.{4,75}?)\s+(?:at|@)\s+([A-Z][A-Za-z0-9&.,' ]{1,45})$", line)
        dash_match = re.match(r"^(.{4,75}?)\s+[–\-|]\s+([A-Z][A-Za-z0-9&.,' ]{1,45})$", line)

        title = line
        company = ""
        if at_match and has_role_word:
            title = at_match.group(1).strip()
            company = at_match.group(2).strip()
        elif dash_match and has_role_word:
            left = dash_match.group(1).strip()
            right = dash_match.group(2).strip()
            if any(w in left.lower() for w in ROLE_HINT_WORDS):
                title = left
                if not any(loc in right.lower() for loc in ("remote", "hybrid", "full-time", "part-time", "contract")):
                    company = right

        if not has_role_word:
            continue

        norm = re.sub(r"\s+", " ", title.lower()).strip()
        if norm not in seen and len(title) >= 5:
            seen.add(norm)
            candidates.append(
                {
                    "job_title": title,
                    "company_name": company,
                    "job_url": match_job_alert_link(title, company, clean_links),
                }
            )
            if len(candidates) >= 20:
                break

    if not candidates and clean_links:
        for url, anchor in clean_links:
            a_clean = re.sub(r"\s+", " ", anchor).strip(" •-*|:")
            if len(a_clean) < 5 or len(a_clean) > 100:
                continue
            a_low = a_clean.lower()
            if any(noise in a_low for noise in NOISE_LINE_PATTERNS):
                continue
            if any(w in a_low for w in ("view job", "apply now", "see job", "view role", "view all", "see all", "manage")):
                continue
            if any(w in a_low for w in ROLE_HINT_WORDS):
                norm = a_low.strip()
                if norm not in seen:
                    seen.add(norm)
                    candidates.append(
                        {
                            "job_title": a_clean,
                            "company_name": "",
                            "job_url": url,
                        }
                    )
                    if len(candidates) >= 20:
                        break

    return candidates


def needs_ai_refinement(
    category: str,
    sender: str,
    subject: str,
    body: str,
) -> bool:
    """Smart hybrid check: only wake Local AI when rules output is incomplete or ambiguous."""
    if category == "job_alert":
        return len(extract_job_alert_titles(subject, body)) == 0

    if category == "application_update":
        info = extract_application_info(sender, subject, body)
        comp_low = info["company"].strip().lower()
        role_low = info["role_title"].strip().lower()
        if comp_low in ("", "unknown", "unknown company"):
            return True
        if role_low in ("", "software / product role", "untitled role") or not any(
            w in role_low for w in ROLE_HINT_WORDS
        ):
            return True
        return False

    if category == "interview":
        iv_info = extract_interview_info(sender, subject, body, [], "")
        comp_low = iv_info["company"].strip().lower()
        role_low = iv_info["role_title"].strip().lower()
        if comp_low in ("", "unknown", "unknown company"):
            return True
        if role_low in ("", "software / product role", "untitled role") or not any(
            w in role_low for w in ROLE_HINT_WORDS
        ):
            return True
        return False

    sample = normalize_text(f"{sender} {subject} {body[:800]}").lower()
    clue_words = (
        "recruiter",
        "hiring",
        "candidate",
        "application",
        "interview",
        "opportunity",
        "position",
        "progressing",
        "moving forward",
        "resume",
        "cv",
        "talent",
    )
    return sum(1 for w in clue_words if w in sample) >= 2
