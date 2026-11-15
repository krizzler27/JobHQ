import type { Application } from '../types';

export function getDaysSinceUpdate(app: Application): number {
  const raw = app.last_update_date || app.applied_date || app.updated_at;
  if (!raw) return 0;
  const parsed = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(parsed.getTime())) return 0;
  const diffMs = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function isStaleApplication(app: Application, thresholdDays = 10): boolean {
  if (app.status !== 'applied' && app.status !== 'ghosted') return false;
  return getDaysSinceUpdate(app) >= thresholdDays;
}

export function escapeCsvCell(val: string | number | null | undefined): string {
  let s = val === null || val === undefined ? '' : String(val);
  // Formula injection defense: neutralize spreadsheet formula triggers (=, +, -, @)
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsvString(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const csvContent = buildCsvString(headers, rows);
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const formatHourAmPm = (hour24: number, minute = 0): string => {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  if (minute === 0) return `${h12} ${period}`;
  return `${h12}:${String(minute).padStart(2, '0')} ${period}`;
};

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function describeCron(rawExpr: string): string {
  const cleaned = String(rawExpr || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Not scheduled';

  const macroMap: Record<string, string> = {
    '@hourly': 'Every hour',
    '@daily': 'Daily at 12 AM',
    '@midnight': 'Daily at 12 AM',
    '@weekly': 'Weekly on Sun',
    '@monthly': 'Monthly on day 1',
  };
  if (macroMap[cleaned.toLowerCase()]) return macroMap[cleaned.toLowerCase()];

  const parts = cleaned.split(' ');
  if (parts.length !== 5) return cleaned;
  const [min, hr, dom, mon, dow] = parts;

  if (min === '*' && hr === '*' && dom === '*' && mon === '*' && dow === '*') {
    return 'Every minute';
  }
  if (/^\*\/(\d+)$/.test(min) && hr === '*' && dom === '*' && mon === '*' && dow === '*') {
    const step = Number(min.slice(2));
    return step === 1 ? 'Every minute' : `Every ${step} min`;
  }
  if (/^\d+$/.test(min) && hr === '*' && dom === '*' && mon === '*' && dow === '*') {
    const m = Number(min);
    return m === 0 ? 'Every hour' : `Hourly at :${String(m).padStart(2, '0')}`;
  }
  if (/^\d+$/.test(min) && /^\*\/(\d+)$/.test(hr) && dom === '*' && mon === '*' && dow === '*') {
    const step = Number(hr.slice(2));
    return step === 1 ? 'Every hour' : `Every ${step} hours`;
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && dom === '*' && mon === '*') {
    const t = formatHourAmPm(Number(hr), Number(min));
    if (dow === '*') return `Daily at ${t}`;
    if (dow === '1-5' || dow.toLowerCase() === 'mon-fri') return `Weekdays at ${t}`;
    if (dow === '0,6' || dow === '6,0') return `Weekends at ${t}`;
    if (/^\d$/.test(dow)) return `Every ${DOW_LABELS[Number(dow)] || dow} at ${t}`;
  }
  if (/^\d+$/.test(min) && /^\d+(?:,\d+)+$/.test(hr) && dom === '*' && mon === '*' && dow === '*') {
    const m = Number(min);
    const times = hr.split(',').map((h) => formatHourAmPm(Number(h), m));
    return `Daily at ${times.join(' & ')}`;
  }
  if (
    /^\d+$/.test(min) &&
    /^(\d+)-(\d+)\/(\d+)$/.test(hr) &&
    dom === '*' &&
    mon === '*' &&
    (dow === '1-5' || dow.toLowerCase() === 'mon-fri' || dow === '*')
  ) {
    const match = hr.match(/^(\d+)-(\d+)\/(\d+)$/);
    if (match) {
      const start = formatHourAmPm(Number(match[1]));
      const end = formatHourAmPm(Number(match[2]));
      const prefix = dow === '*' ? 'Daily' : 'Weekdays';
      return `${prefix} ${start}–${end} (every ${match[3]}h)`;
    }
  }
  return `Custom (${cleaned})`;
}

export function parseUtcTimestamp(rawIso: string | null | undefined): Date | null {
  const s = String(rawIso || '').trim();
  if (!s) return null;
  // Normalize naive ISO timestamps (e.g. "2026-11-14T08:30:00") as UTC
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  const normalized = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !hasZone ? `${s.replace(' ', 'T')}Z` : s;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatLocalDateTime(rawIso: string | null | undefined): string {
  const d = parseUtcTimestamp(rawIso);
  if (!d) return rawIso ? String(rawIso).slice(0, 16).replace('T', ' ') : '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatLocalDateTimeTooltip(rawIso: string | null | undefined): string {
  const d = parseUtcTimestamp(rawIso);
  if (!d) return String(rawIso || '');
  const localStr = d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return `${localStr} (stored UTC: ${String(rawIso).trim()})`;
}

