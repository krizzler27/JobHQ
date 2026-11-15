"""Pure-Python 5-field standard Unix cron parser, validator, and next-run calculator."""

from __future__ import annotations

from datetime import datetime, timedelta

MONTH_ALIASES = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

DOW_ALIASES = {
    "sun": 0,
    "mon": 1,
    "tue": 2,
    "wed": 3,
    "thu": 4,
    "fri": 5,
    "sat": 6,
}

CRON_MACROS = {
    "@hourly": "0 * * * *",
    "@daily": "0 0 * * *",
    "@midnight": "0 0 * * *",
    "@weekly": "0 0 * * 0",
    "@monthly": "0 0 1 * *",
}


def _parse_token_val(raw: str, min_v: int, max_v: int, aliases: dict[str, int] | None, is_dow: bool) -> int:
    low = raw.strip().lower()
    if aliases and low in aliases:
        val = aliases[low]
    else:
        val = int(low)
    if is_dow and val == 7:
        val = 0
    if val < min_v or val > max_v:
        raise ValueError(f"Value '{raw}' out of range [{min_v}..{max_v}]")
    return val


def _parse_field(
    field: str,
    min_v: int,
    max_v: int,
    aliases: dict[str, int] | None = None,
    is_dow: bool = False,
) -> tuple[set[int], bool]:
    raw = field.strip()
    if not raw:
        raise ValueError("Empty cron field")
    if raw == "*":
        return set(range(min_v, max_v + 1)), True

    values: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            raise ValueError(f"Invalid empty list item in '{field}'")

        step = 1
        if "/" in part:
            pieces = part.split("/")
            if len(pieces) != 2 or not pieces[1]:
                raise ValueError(f"Invalid step syntax '{part}'")
            base, step_str = pieces
            step = int(step_str)
            if step <= 0:
                raise ValueError(f"Step must be positive in '{part}'")
        else:
            base = part

        if base == "*":
            start, end = min_v, max_v
        elif "-" in base:
            bounds = base.split("-")
            if len(bounds) != 2:
                raise ValueError(f"Invalid range '{part}'")
            start = _parse_token_val(bounds[0], min_v, max_v, aliases, is_dow)
            end = _parse_token_val(bounds[1], min_v, max_v, aliases, is_dow)
            if start > end:
                raise ValueError(f"Range start exceeds end in '{part}'")
        else:
            single = _parse_token_val(base, min_v, max_v, aliases, is_dow)
            if "/" in part:
                start, end = single, max_v
            else:
                values.add(single)
                continue

        for v in range(start, end + 1, step):
            values.add(0 if (is_dow and v == 7) else v)

    if not values:
        raise ValueError(f"No matching values for '{field}'")
    return values, False


def _normalize_expr(expr: str) -> str:
    cleaned = " ".join(str(expr or "").strip().split())
    if cleaned.lower() in CRON_MACROS:
        return CRON_MACROS[cleaned.lower()]
    return cleaned


def parse_cron(expr: str) -> tuple[set[int], set[int], set[int], bool, set[int], set[int], bool]:
    normalized = _normalize_expr(expr)
    parts = normalized.split(" ")
    if len(parts) != 5:
        raise ValueError("Cron expression must have 5 fields: minute hour day-of-month month day-of-week")

    mins, _ = _parse_field(parts[0], 0, 59)
    hours, _ = _parse_field(parts[1], 0, 23)
    doms, dom_star = _parse_field(parts[2], 1, 31)
    months, _ = _parse_field(parts[3], 1, 12, aliases=MONTH_ALIASES)
    dows, dow_star = _parse_field(parts[4], 0, 6, aliases=DOW_ALIASES, is_dow=True)
    return mins, hours, doms, dom_star, months, dows, dow_star


def validate_cron_expression(expr: str) -> tuple[bool, str]:
    try:
        parse_cron(expr)
        return True, ""
    except Exception as exc:
        return False, str(exc)


def _python_weekday_to_cron(dt: datetime) -> int:
    # Python Monday=0..Sunday=6 -> Cron Sunday=0, Monday=1..Saturday=6
    return (dt.weekday() + 1) % 7


def _date_matches(dt: datetime, doms: set[int], dom_star: bool, months: set[int], dows: set[int], dow_star: bool) -> bool:
    if dt.month not in months:
        return False
    dom_ok = dt.day in doms
    dow_ok = _python_weekday_to_cron(dt) in dows
    if not dom_star and not dow_star:
        return dom_ok or dow_ok
    return dom_ok and dow_ok


def matches_cron(expr: str, dt: datetime) -> bool:
    mins, hours, doms, dom_star, months, dows, dow_star = parse_cron(expr)
    return (
        dt.minute in mins
        and dt.hour in hours
        and _date_matches(dt, doms, dom_star, months, dows, dow_star)
    )


def next_cron_run(expr: str, after_dt: datetime | None = None) -> datetime | None:
    """Finds the next matching local datetime strictly after `after_dt` (up to 366 days ahead)."""
    try:
        mins, hours, doms, dom_star, months, dows, dow_star = parse_cron(expr)
    except Exception:
        return None

    sorted_hours = sorted(hours)
    sorted_mins = sorted(mins)

    base = (after_dt or datetime.now().astimezone()).replace(second=0, microsecond=0) + timedelta(minutes=1)
    cursor_day = base.replace(hour=0, minute=0)

    for day_offset in range(367):
        day_dt = cursor_day + timedelta(days=day_offset)
        if not _date_matches(day_dt, doms, dom_star, months, dows, dow_star):
            continue
        for hr in sorted_hours:
            if day_offset == 0 and hr < base.hour:
                continue
            for mn in sorted_mins:
                if day_offset == 0 and hr == base.hour and mn < base.minute:
                    continue
                return day_dt.replace(hour=hr, minute=mn)
    return None
