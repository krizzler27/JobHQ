import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateKey,
  getMonthGrid,
  getWeekDays,
  normalizeCalendarEvents,
  groupEventsByDate,
  formatTimeRange,
} from './calendarHelpers';
import type { Application, Interview } from '../types';

describe('calendarHelpers - Grid Generation', () => {
  it('generates month grid with Monday as first day of week', () => {
    // November 2026: Nov 1 is Sunday.
    // Monday start: Sunday is index 6, so 6 leading days from October.
    const cells = getMonthGrid(2026, 10, 1);
    assert.ok(cells.length === 35 || cells.length === 42);

    // The first cell should be a Monday from October
    const firstCell = cells[0];
    assert.equal(firstCell.date.getDay(), 1); // 1 = Monday
    assert.equal(firstCell.isCurrentMonth, false);

    // Day 1 of November is at index 6 (Sunday)
    const novFirstCell = cells[6];
    assert.equal(novFirstCell.dayNumber, 1);
    assert.equal(novFirstCell.dateKey, '2026-11-01');
    assert.equal(novFirstCell.isCurrentMonth, true);
  });

  it('generates month grid with Sunday as first day of week', () => {
    // November 2026: Nov 1 is Sunday.
    // Sunday start: Nov 1 is index 0, so 0 leading days!
    const cells = getMonthGrid(2026, 10, 0);
    assert.ok(cells.length === 35 || cells.length === 42);

    const firstCell = cells[0];
    assert.equal(firstCell.date.getDay(), 0); // 0 = Sunday
    assert.equal(firstCell.dayNumber, 1);
    assert.equal(firstCell.dateKey, '2026-11-01');
    assert.equal(firstCell.isCurrentMonth, true);
  });

  it('generates 7 week days respecting Monday vs Sunday start', () => {
    // Wednesday Nov 4, 2026
    const wed = new Date(2026, 10, 4);

    const weekMon = getWeekDays(wed, 1);
    assert.equal(weekMon.length, 7);
    assert.equal(weekMon[0].getDay(), 1); // Monday

    const weekSun = getWeekDays(wed, 0);
    assert.equal(weekSun.length, 7);
    assert.equal(weekSun[0].getDay(), 0); // Sunday
  });
});

describe('calendarHelpers - Event Normalization & High-Density Days', () => {
  const createMockApp = (id: number, company: string, status: Application['status'], dateStr: string): Application => ({
    id,
    company,
    role_title: 'Software Engineer',
    status,
    source_platform: 'Manual',
    location: 'Remote',
    notes: '',
    thread_id: '',
    latest_email_subject: '',
    latest_email_snippet: '',
    job_url: '',
    applied_date: dateStr,
    last_update_date: dateStr,
    created_at: dateStr,
    updated_at: dateStr,
  });

  const createMockInterview = (id: number, company: string, scheduledIso: string): Interview => ({
    id,
    application_id: 1,
    company,
    role_title: 'Software Engineer',
    round_label: 'Technical Screen',
    scheduled_at: scheduledIso,
    duration_minutes: 45,
    timezone: 'UTC',
    meeting_link: 'https://meet.google.com/abc-defg-hij',
    job_url: '',
    interviewer_names: 'Alex',
    status: 'upcoming',
    source_message_id: 'msg-1',
    created_at: scheduledIso,
  });

  it('normalizes applications and interviews into sorted calendar events', () => {
    const apps = [
      createMockApp(1, 'Stripe', 'applied', '2026-11-15'),
      createMockApp(2, 'Google', 'offer', '2026-11-15'),
    ];
    const ivs = [
      createMockInterview(101, 'Apple', '2026-11-15T14:30:00Z'),
    ];

    const events = normalizeCalendarEvents(apps, ivs);
    assert.equal(events.length, 3);

    // The interview should be prioritized first on the day
    assert.equal(events[0].kind, 'interview');
    assert.equal(events[0].company, 'Apple');
    assert.ok(events[0].timeStr);

    // Followed by applications
    assert.equal(events[1].company, 'Google');
    assert.equal(events[1].kind, 'offer');
    assert.equal(events[2].company, 'Stripe');
    assert.equal(events[2].kind, 'applied');
  });

  it('handles high-density days (e.g. 10+ jobs applied on the same date)', () => {
    const targetDate = '2026-11-18';
    const bulkApps: Application[] = [];

    // Create 12 applications on the same date
    for (let i = 1; i <= 12; i++) {
      bulkApps.push(createMockApp(i, `Company ${i}`, 'applied', targetDate));
    }
    const iv = createMockInterview(99, 'Meta', `${targetDate}T10:00:00Z`);

    const events = normalizeCalendarEvents(bulkApps, [iv]);
    assert.equal(events.length, 13);

    const grouped = groupEventsByDate(events);
    assert.ok(grouped[targetDate]);
    assert.equal(grouped[targetDate].length, 13);

    // Month grid cell correctly receives all 13 events for this day
    const grid = getMonthGrid(2026, 10, 1, grouped);
    const cell = grid.find((c) => c.dateKey === targetDate);
    assert.ok(cell);
    assert.equal(cell.events.length, 13);
  });

  it('formats interview time ranges correctly', () => {
    const range = formatTimeRange('2026-11-18T14:00:00', 45);
    assert.ok(range.includes('–'));
  });

  it('converts UTC ISO timestamps to local date keys seamlessly', () => {
    const appWithIso = createMockApp(999, 'Global Corp', 'applied', '2026-11-20T18:30:00Z');
    const events = normalizeCalendarEvents([appWithIso], []);
    assert.equal(events.length, 1);
    // Verifies dateKey matches local date representation
    const expectedLocalKey = formatDateKey(new Date('2026-11-20T18:30:00Z'));
    assert.equal(events[0].dateKey, expectedLocalKey);
  });
});
