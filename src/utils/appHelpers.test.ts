import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isStaleApplication,
  getDaysSinceUpdate,
  escapeCsvCell,
  buildCsvString,
  describeCron,
  parseUtcTimestamp,
} from './appHelpers';
import type { Application } from '../types';

describe('appHelpers - isStaleApplication', () => {
  const createMockApp = (status: Application['status'], daysAgo: number): Application => {
    const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    return {
      id: 1,
      company: 'Acme Corp',
      role_title: 'Full Stack Engineer',
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
    };
  };

  it('marks applied applications older than 10 days as stale', () => {
    const oldApp = createMockApp('applied', 12);
    assert.equal(getDaysSinceUpdate(oldApp), 12);
    assert.equal(isStaleApplication(oldApp), true);
  });

  it('does not mark applied applications younger than 10 days as stale', () => {
    const recentApp = createMockApp('applied', 4);
    assert.equal(getDaysSinceUpdate(recentApp), 4);
    assert.equal(isStaleApplication(recentApp), false);
  });

  it('marks ghosted applications as stale if beyond threshold', () => {
    const ghostedApp = createMockApp('ghosted', 15);
    assert.equal(isStaleApplication(ghostedApp), true);
  });

  it('does not mark non-applied statuses (interviewing, rejected, offer) as stale', () => {
    const interviewApp = createMockApp('interviewing', 30);
    assert.equal(isStaleApplication(interviewApp), false);

    const rejectedApp = createMockApp('rejected', 45);
    assert.equal(isStaleApplication(rejectedApp), false);

    const offerApp = createMockApp('offer', 20);
    assert.equal(isStaleApplication(offerApp), false);
  });

  it('respects a custom threshold', () => {
    const app = createMockApp('applied', 7);
    assert.equal(isStaleApplication(app, 10), false);
    assert.equal(isStaleApplication(app, 5), true);
  });
});

describe('appHelpers - CSV formula injection and escaping', () => {
  it('escapes cells containing commas, quotes, and newlines', () => {
    assert.equal(escapeCsvCell('Hello, World'), '"Hello, World"');
    assert.equal(escapeCsvCell('Role with "quotes"'), '"Role with ""quotes"""');
    assert.equal(escapeCsvCell('Line 1\nLine 2'), '"Line 1\nLine 2"');
  });

  it('neutralizes formula injection characters (=, +, -, @, tabs)', () => {
    // Formula prefixes must be prepended with a single quote
    assert.equal(escapeCsvCell('=cmd|calc!A0'), '\'=cmd|calc!A0');
    assert.equal(escapeCsvCell('=cmd|"/C calc"!A0'), '"\'=cmd|""/C calc""!A0"');
    assert.equal(escapeCsvCell('+12345'), '\'+12345');
    assert.equal(escapeCsvCell('-SUM(A1:B2)'), '\'-SUM(A1:B2)');
    assert.equal(escapeCsvCell('@mention'), '\'@mention');
    assert.equal(escapeCsvCell('\tmaliciousTab'), '\'\tmaliciousTab');
  });

  it('builds full CSV content with UTF-8 BOM and CRLF line endings', () => {
    const headers = ['Company', 'Role', 'Formula'];
    const rows = [
      ['Stripe', 'Staff Engineer', '=1+1'],
      ['Google, Inc.', 'Engineering "Lead"', 'Normal Text'],
    ];

    const csv = buildCsvString(headers, rows);
    // Verifies BOM prefix
    assert.ok(csv.startsWith('\uFEFF'));
    // Verifies row separator
    assert.ok(csv.includes('\r\n'));
    // Verifies sanitized formula
    assert.ok(csv.includes("'=1+1"));
    // Verifies quoted commas and double quotes
    assert.ok(csv.includes('"Google, Inc."'));
    assert.ok(csv.includes('"Engineering ""Lead"""'));
  });
});

describe('appHelpers - describeCron', () => {
  it('translates standard macros', () => {
    assert.equal(describeCron('@hourly'), 'Every hour');
    assert.equal(describeCron('@daily'), 'Daily at 12 AM');
    assert.equal(describeCron('@midnight'), 'Daily at 12 AM');
    assert.equal(describeCron('@weekly'), 'Weekly on Sun');
  });

  it('translates step and minute expressions', () => {
    assert.equal(describeCron('* * * * *'), 'Every minute');
    assert.equal(describeCron('*/15 * * * *'), 'Every 15 min');
    assert.equal(describeCron('0 * * * *'), 'Every hour');
  });

  it('translates daily and weekday schedules', () => {
    assert.equal(describeCron('0 9 * * *'), 'Daily at 9 AM');
    assert.equal(describeCron('30 14 * * 1-5'), 'Weekdays at 2:30 PM');
    assert.equal(describeCron('0 9 * * 0,6'), 'Weekends at 9 AM');
  });

  it('falls back to custom expression for arbitrary syntax', () => {
    assert.equal(describeCron('1 2 3 4 5'), 'Custom (1 2 3 4 5)');
    assert.equal(describeCron(''), 'Not scheduled');
  });
});

describe('appHelpers - parseUtcTimestamp', () => {
  it('parses timestamps with explicit Z or timezone offsets', () => {
    const parsed = parseUtcTimestamp('2026-11-15T09:30:00Z');
    assert.ok(parsed instanceof Date);
    assert.equal(parsed?.getUTCFullYear(), 2026);
    assert.equal(parsed?.getUTCHours(), 9);
    assert.equal(parsed?.getUTCMinutes(), 30);
  });

  it('normalizes naive ISO strings without timezone to UTC', () => {
    const parsed = parseUtcTimestamp('2026-11-15T09:30:00');
    assert.ok(parsed instanceof Date);
    assert.equal(parsed?.getUTCHours(), 9);
  });

  it('returns null for invalid or empty inputs', () => {
    assert.equal(parseUtcTimestamp(null), null);
    assert.equal(parseUtcTimestamp(''), null);
    assert.equal(parseUtcTimestamp('invalid-date'), null);
  });
});
