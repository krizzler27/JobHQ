import type { Application, Interview } from '../types';

export type CalendarEventKind =
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'ghosted'
  | 'interviewing';

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  company: string;
  role_title: string;
  dateKey: string; // YYYY-MM-DD
  dateTimeIso?: string;
  timeStr?: string; // e.g. "2:30 PM"
  timeEndStr?: string;
  durationMinutes?: number;
  meetingLink?: string;
  status: string;
  applicationId?: number;
  interviewId?: number;
  rawApplication?: Application;
  rawInterview?: Interview;
}

export interface CalendarDayCell {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

/** Formats a Date object to YYYY-MM-DD in local time */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD safely into a local Date */
export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Formats an ISO string to local 12-hour time (e.g. "2:30 PM") */
export function formatTimeAmPm(date: Date): string {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mStr = String(minute).padStart(2, '0');
  return `${h12}:${mStr} ${period}`;
}

/** Formats a full time range, e.g. "2:00 PM – 2:45 PM" */
export function formatTimeRange(isoString: string, durationMinutes = 45): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const start = formatTimeAmPm(d);
  const endD = new Date(d.getTime() + durationMinutes * 60 * 1000);
  const end = formatTimeAmPm(endD);
  return `${start} – ${end}`;
}

/**
 * Normalizes all applications and scheduled interviews into unified CalendarEvents.
 * Reactively recalculates whenever applications or interviews change.
 */
export function normalizeCalendarEvents(
  applications: Application[],
  interviews: Interview[],
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // 1. Process applications (applied events)
  for (const app of applications) {
    const rawDate = app.applied_date || app.created_at || app.updated_at;
    if (!rawDate) continue;

    let dateKey = '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      dateKey = rawDate;
    } else {
      const d = new Date(rawDate);
      dateKey = !Number.isNaN(d.getTime()) ? formatDateKey(d) : rawDate.slice(0, 10);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;

    let kind: CalendarEventKind = 'applied';
    if (app.status === 'offer') kind = 'offer';
    else if (app.status === 'rejected') kind = 'rejected';
    else if (app.status === 'ghosted') kind = 'ghosted';
    else if (app.status === 'interviewing') kind = 'interviewing';

    events.push({
      id: `app-${app.id}`,
      kind,
      title: `${app.company} — ${app.role_title}`,
      company: app.company,
      role_title: app.role_title,
      dateKey,
      status: app.status,
      applicationId: app.id,
      rawApplication: app,
    });
  }

  // 2. Process interviews (scheduled events)
  for (const iv of interviews) {
    if (!iv.scheduled_at) continue;
    const d = new Date(iv.scheduled_at);
    if (Number.isNaN(d.getTime())) continue;

    const dateKey = formatDateKey(d);
    const timeStr = formatTimeAmPm(d);
    const duration = iv.duration_minutes || 45;
    const endD = new Date(d.getTime() + duration * 60 * 1000);
    const timeEndStr = formatTimeAmPm(endD);

    events.push({
      id: `iv-${iv.id}`,
      kind: 'interview',
      title: `${iv.company} · ${iv.round_label || 'Interview'}`,
      company: iv.company,
      role_title: iv.role_title,
      dateKey,
      dateTimeIso: iv.scheduled_at,
      timeStr,
      timeEndStr,
      durationMinutes: duration,
      meetingLink: iv.meeting_link,
      status: iv.status,
      interviewId: iv.id,
      applicationId: iv.application_id ?? undefined,
      rawInterview: iv,
    });
  }

  // Sort events: interviews first (by time), then applications by company
  events.sort((a, b) => {
    if (a.dateKey !== b.dateKey) {
      return a.dateKey.localeCompare(b.dateKey);
    }
    // Interviews go before applications on the same day
    if (a.kind === 'interview' && b.kind !== 'interview') return -1;
    if (b.kind === 'interview' && a.kind !== 'interview') return 1;
    if (a.dateTimeIso && b.dateTimeIso) {
      return a.dateTimeIso.localeCompare(b.dateTimeIso);
    }
    return a.company.localeCompare(b.company);
  });

  return events;
}

/** Groups an array of calendar events into a map of dateKey -> CalendarEvent[] */
export function groupEventsByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const map: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (!map[ev.dateKey]) {
      map[ev.dateKey] = [];
    }
    map[ev.dateKey].push(ev);
  }
  return map;
}

/**
 * Generates the month grid cells (35 or 42 cells)
 * @param year e.g. 2026
 * @param month 0-indexed month (0 = Jan, 11 = Dec)
 * @param firstDayOfWeek 1 = Monday (default), 0 = Sunday
 */
export function getMonthGrid(
  year: number,
  month: number,
  firstDayOfWeek: 0 | 1 = 1,
  eventsByDate: Record<string, CalendarEvent[]> = {},
): CalendarDayCell[] {
  const todayKey = formatDateKey(new Date());
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const numDaysInMonth = lastOfMonth.getDate();
  const startDayIndex = firstOfMonth.getDay(); // 0 is Sunday, 1 is Monday

  // Calculate leading days
  let leadingDaysCount =
    firstDayOfWeek === 1
      ? (startDayIndex + 6) % 7 // Monday start: Mon(1)->0, Tue(2)->1, Sun(0)->6
      : startDayIndex; // Sunday start: Sun(0)->0, Mon(1)->1

  const cells: CalendarDayCell[] = [];

  // 1. Leading days from previous month
  const prevMonthLastDate = new Date(year, month, 0).getDate();
  for (let i = leadingDaysCount - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDate - i);
    const key = formatDateKey(d);
    cells.push({
      date: d,
      dateKey: key,
      dayNumber: d.getDate(),
      isCurrentMonth: false,
      isToday: key === todayKey,
      events: eventsByDate[key] || [],
    });
  }

  // 2. Days of current month
  for (let day = 1; day <= numDaysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = formatDateKey(d);
    cells.push({
      date: d,
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: key === todayKey,
      events: eventsByDate[key] || [],
    });
  }

  // 3. Trailing days from next month to complete the 7-column grid
  const totalSlots = cells.length > 35 ? 42 : 35;
  const trailingDaysCount = totalSlots - cells.length;
  for (let day = 1; day <= trailingDaysCount; day++) {
    const d = new Date(year, month + 1, day);
    const key = formatDateKey(d);
    cells.push({
      date: d,
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: key === todayKey,
      events: eventsByDate[key] || [],
    });
  }

  return cells;
}

/**
 * Returns 7 days for the week containing `centerDate`.
 * @param centerDate The active date
 * @param firstDayOfWeek 1 = Monday, 0 = Sunday
 */
export function getWeekDays(centerDate: Date, firstDayOfWeek: 0 | 1 = 1): Date[] {
  const currentDay = centerDate.getDay();
  const offset =
    firstDayOfWeek === 1
      ? (currentDay + 6) % 7 // Monday = 0, Sunday = 6
      : currentDay; // Sunday = 0

  const startOfWeek = new Date(centerDate);
  startOfWeek.setDate(centerDate.getDate() - offset);
  startOfWeek.setHours(0, 0, 0, 0);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push(d);
  }
  return days;
}

/** Event theme colors and badge badges */
export const EVENT_TONES: Record<
  CalendarEventKind,
  {
    bg: string;
    text: string;
    border: string;
    dot: string;
    label: string;
  }
> = {
  applied: {
    bg: 'bg-[#4f46e5]/10 hover:bg-[#4f46e5]/15 dark:bg-[#4f46e5]/20',
    text: 'text-[#4f46e5] dark:text-indigo-300 font-bold',
    border: 'border-[#4f46e5]/25',
    dot: 'bg-[#4f46e5]',
    label: 'Applied',
  },
  interview: {
    bg: 'bg-[#234aff]/10 hover:bg-[#234aff]/15 dark:bg-blue-950/50',
    text: 'text-[#234aff] dark:text-blue-300 font-bold',
    border: 'border-[#234aff]/25',
    dot: 'bg-[#234aff]',
    label: 'Interview',
  },
  interviewing: {
    bg: 'bg-[#234aff]/10 hover:bg-[#234aff]/15 dark:bg-blue-950/50',
    text: 'text-[#234aff] dark:text-blue-300 font-bold',
    border: 'border-[#234aff]/25',
    dot: 'bg-[#234aff]',
    label: 'Interviewing',
  },
  offer: {
    bg: 'bg-[#107e3e]/10 hover:bg-[#107e3e]/15 dark:bg-emerald-950/50',
    text: 'text-[#107e3e] dark:text-emerald-300 font-bold',
    border: 'border-[#107e3e]/25',
    dot: 'bg-[#107e3e]',
    label: 'Offer',
  },
  rejected: {
    bg: 'bg-[#be123c]/10 hover:bg-[#be123c]/15 dark:bg-rose-950/50',
    text: 'text-[#be123c] dark:text-rose-300 font-bold',
    border: 'border-[#be123c]/25',
    dot: 'bg-[#be123c]',
    label: 'Rejected',
  },
  ghosted: {
    bg: 'bg-[#78716c]/10 hover:bg-[#78716c]/15 dark:bg-slate-800/80',
    text: 'text-[#78716c] dark:text-slate-300 font-bold',
    border: 'border-[#78716c]/25',
    dot: 'bg-[#78716c]',
    label: 'Ghosted',
  },
};
