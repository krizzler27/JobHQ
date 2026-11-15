"""Job alert relevance scoring based on Target Role Profile and tracked application history."""

from backend.parsing.html_links import tokenize_text


def score_job_title(
    job_title: str, company_name: str, profile: dict, past_apps: list[dict]
) -> tuple[int, str]:
    title_low = job_title.lower()
    title_tokens = tokenize_text(job_title)

    excluded = [str(x).strip().lower() for x in profile.get("excluded_keywords", []) if str(x).strip()]
    for ex in excluded:
        if ex in title_low:
            return 10, f'Excluded by keyword "{ex}"'

    target_titles = [str(x).strip() for x in profile.get("target_titles", []) if str(x).strip()]
    keywords = [str(x).strip() for x in profile.get("keywords", []) if str(x).strip()]

    score = 30
    reasons: list[str] = []

    best_target_sim = 0.0
    best_target_name = ""
    for tt in target_titles:
        tt_low = tt.lower()
        if tt_low in title_low or title_low in tt_low:
            best_target_sim = 1.0
            best_target_name = tt
            break
        tt_tokens = tokenize_text(tt)
        if tt_tokens:
            overlap = len(title_tokens & tt_tokens) / max(len(tt_tokens), 1)
            if overlap > best_target_sim:
                best_target_sim = overlap
                best_target_name = tt

    if best_target_sim >= 0.8:
        score += 50
        reasons.append(f'Strong match for target role "{best_target_name}"')
    elif best_target_sim >= 0.4:
        score += 32
        reasons.append(f'Partial match for target role "{best_target_name}"')

    matched_kw = [kw for kw in keywords if kw.lower() in title_low]
    if matched_kw:
        score += min(25, len(matched_kw) * 12)
        reasons.append(f'Matches keyword {", ".join(matched_kw[:3])}')

    best_app_sim = 0.0
    best_app_role = ""
    for app in past_apps[:30]:
        app_role = str(app.get("role_title", ""))
        app_tokens = tokenize_text(app_role)
        if app_tokens:
            overlap = len(title_tokens & app_tokens) / max(len(app_tokens), 1)
            if overlap > best_app_sim:
                best_app_sim = overlap
                best_app_role = app_role

    if best_app_sim >= 0.45:
        score += 20
        reasons.append(f'Similar to your application "{best_app_role}"')

    if not target_titles and not keywords and not past_apps:
        score = 62
        reasons.append("Parsed from alert digest (set Target Roles to refine score)")
    elif not reasons:
        reasons.append("Low overlap with Target Role Profile and past applications")

    return min(99, max(5, score)), " · ".join(reasons)
