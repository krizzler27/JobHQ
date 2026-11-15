import React, { useMemo, useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  Search,
  Video,
  X,
  Briefcase,
  Sparkles,
  Ban,
  Clock,
  Columns3,
  CalendarDays,
  ListFilter,
  CheckCircle2,
} from 'lucide-react';
import type { Application, Interview, InterviewStatus } from '../types';
import {
  CalendarEvent,
  CalendarEventKind,
  EVENT_TONES,
  formatDateKey,
  formatTimeRange,
  getMonthGrid,
  getWeekDays,
  groupEventsByDate,
  normalizeCalendarEvents,
  parseDateKey,
} from '../utils/calendarHelpers';

interface CalendarViewProps {
  applications: Application[];
  interviews: Interview[];
  onSelectApplication: (app: Application) => void;
  onUpdateInterviewStatus: (id: number, status: InterviewStatus) => Promise<void>;
  onDeleteInterview: (id: number) => Promise<void>;
  onAddInterview?: () => void;
  onAddApplication?: () => void;
}

type CalendarMode = 'month' | 'week' | 'agenda';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_NAMES_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  applications,
  interviews,
  onSelectApplication,
  onUpdateInterviewStatus,
  onDeleteInterview,
  onAddInterview,
  onAddApplication,
}) => {
  // Navigation state
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [mode, setMode] = useState<CalendarMode>('month');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<0 | 1>(() => {
    const saved = localStorage.getItem('job_tracker_calendar_first_day');
    return saved === '0' ? 0 : 1; // Default to 1 (Monday)
  });

  // Filter state
  const [search, setSearch] = useState('');
  const [activeKindFilter, setActiveKindFilter] = useState<'all' | CalendarEventKind>('all');

  // Day Inspector Drawer state (for high-density days / +N more)
  const [inspectedDateKey, setInspectedDateKey] = useState<string | null>(null);

  // Persist first day of week preference
  const toggleFirstDayOfWeek = () => {
    const next = firstDayOfWeek === 1 ? 0 : 1;
    setFirstDayOfWeek(next);
    localStorage.setItem('job_tracker_calendar_first_day', String(next));
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // 1. Reactive derivation of calendar events from central state
  const allEvents = useMemo(
    () => normalizeCalendarEvents(applications, interviews),
    [applications, interviews],
  );

  // 2. Filter events by search query and kind filter
  const filteredEvents = useMemo(() => {
    let list = allEvents;

    if (activeKindFilter !== 'all') {
      list = list.filter((ev) => ev.kind === activeKindFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (ev) =>
          ev.company.toLowerCase().includes(q) ||
          ev.role_title.toLowerCase().includes(q) ||
          ev.title.toLowerCase().includes(q),
      );
    }

    return list;
  }, [allEvents, activeKindFilter, search]);

  // 3. Group events by date for O(1) cell lookup
  const eventsByDate = useMemo(
    () => groupEventsByDate(filteredEvents),
    [filteredEvents],
  );

  // 4. Month grid cells
  const monthCells = useMemo(
    () => getMonthGrid(currentYear, currentMonth, firstDayOfWeek, eventsByDate),
    [currentYear, currentMonth, firstDayOfWeek, eventsByDate],
  );

  // 5. Week days
  const weekDays = useMemo(
    () => getWeekDays(currentDate, firstDayOfWeek),
    [currentDate, firstDayOfWeek],
  );

  // Navigation handlers
  const handlePrev = () => {
    if (mode === 'month') {
      setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    } else if (mode === 'week') {
      const next = new Date(currentDate);
      next.setDate(currentDate.getDate() - 7);
      setCurrentDate(next);
    } else {
      // Agenda moves 1 month back
      setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    }
  };

  const handleNext = () => {
    if (mode === 'month') {
      setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    } else if (mode === 'week') {
      const next = new Date(currentDate);
      next.setDate(currentDate.getDate() + 7);
      setCurrentDate(next);
    } else {
      // Agenda moves 1 month forward
      setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const weekdayHeaders = firstDayOfWeek === 1 ? WEEKDAY_NAMES_MON : WEEKDAY_NAMES_SUN;

  // Selected day events for the Inspector Drawer
  const inspectedEvents = inspectedDateKey ? eventsByDate[inspectedDateKey] || [] : [];
  const inspectedDateLabel = useMemo(() => {
    if (!inspectedDateKey) return '';
    const d = parseDateKey(inspectedDateKey);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [inspectedDateKey]);

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              title="Previous"
              aria-label="Previous"
              className="p-1.5 rounded-md border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              title="Next"
              aria-label="Next"
              className="p-1.5 rounded-md border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="font-display text-base font-semibold text-slate-900 min-w-44">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>

          {/* View Mode Segmented Control */}
          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setMode('month')}
              className={`px-3 py-1 rounded transition-colors ${
                mode === 'month'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setMode('week')}
              className={`px-3 py-1 rounded transition-colors ${
                mode === 'week'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setMode('agenda')}
              className={`px-3 py-1 rounded transition-colors ${
                mode === 'agenda'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Agenda
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Week Start Day Toggle */}
          <button
            type="button"
            onClick={toggleFirstDayOfWeek}
            title="Toggle first day of week"
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            Starts on <span className="font-semibold text-slate-900">{firstDayOfWeek === 1 ? 'Mon' : 'Sun'}</span>
          </button>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search calendar..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md w-48 sm:w-56 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setActiveKindFilter('all')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            activeKindFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
          }`}
        >
          All ({allEvents.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveKindFilter('interview')}
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            activeKindFilter === 'interview'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          Interviews ({allEvents.filter((e) => e.kind === 'interview').length})
        </button>

        <button
          type="button"
          onClick={() => setActiveKindFilter('applied')}
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            activeKindFilter === 'applied'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Applied ({allEvents.filter((e) => e.kind === 'applied').length})
        </button>

        <button
          type="button"
          onClick={() => setActiveKindFilter('offer')}
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            activeKindFilter === 'offer'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Offers ({allEvents.filter((e) => e.kind === 'offer').length})
        </button>

        <button
          type="button"
          onClick={() => setActiveKindFilter('rejected')}
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            activeKindFilter === 'rejected'
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Rejected ({allEvents.filter((e) => e.kind === 'rejected').length})
        </button>

        <button
          type="button"
          onClick={() => setActiveKindFilter('ghosted')}
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            activeKindFilter === 'ghosted'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Ghosted ({allEvents.filter((e) => e.kind === 'ghosted').length})
        </button>
      </div>

      {/* Main View Area */}
      {mode === 'month' ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-600 py-2.5">
            {weekdayHeaders.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Month Grid Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 border-b border-slate-100">
            {monthCells.map((cell) => {
              const maxVisible = 3;
              const visibleEvents = cell.events.slice(0, maxVisible);
              const overflowCount = cell.events.length - maxVisible;

              return (
                <div
                  key={cell.dateKey}
                  onClick={() => setInspectedDateKey(cell.dateKey)}
                  className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors cursor-pointer group hover:bg-slate-50/80 ${
                    cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`inline-flex items-center justify-center text-xs font-mono-tabular w-6 h-6 rounded-full ${
                        cell.isToday
                          ? 'bg-blue-600 text-white font-bold'
                          : cell.isCurrentMonth
                          ? 'text-slate-800 group-hover:text-blue-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {cell.events.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono-tabular">
                        {cell.events.length}
                      </span>
                    )}
                  </div>

                  {/* Event Chips List (Max 3 + Overflow Badge) */}
                  <div className="space-y-1 flex-1 overflow-hidden">
                    {visibleEvents.map((ev) => {
                      const tone = EVENT_TONES[ev.kind] || EVENT_TONES.applied;
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ev.rawApplication) {
                              onSelectApplication(ev.rawApplication);
                            } else {
                              setInspectedDateKey(cell.dateKey);
                            }
                          }}
                          title={`${ev.title}${ev.timeStr ? ` at ${ev.timeStr}` : ''}`}
                          className={`flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded border truncate cursor-pointer transition-transform hover:scale-[1.01] ${tone.bg} ${tone.text} ${tone.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} />
                          {ev.kind === 'interview' && (
                            <span className="font-semibold shrink-0">
                              {ev.timeStr || 'Intv'}:
                            </span>
                          )}
                          <span className="truncate">{ev.company}</span>
                        </div>
                      );
                    })}

                    {/* High-density overflow button (e.g. 10+ jobs in a day) */}
                    {overflowCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectedDateKey(cell.dateKey);
                        }}
                        className="w-full text-left px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50/70 hover:bg-blue-100 rounded border border-blue-200/60 transition-colors"
                      >
                        +{overflowCount} more...
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : mode === 'week' ? (
        /* Week View: 7 Columns with full event cards */
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center py-3">
            {weekDays.map((d) => {
              const key = formatDateKey(d);
              const isToday = key === formatDateKey(new Date());
              return (
                <div key={key} className="space-y-0.5">
                  <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </p>
                  <span
                    className={`inline-flex items-center justify-center text-xs font-mono-tabular w-6 h-6 rounded-full ${
                      isToday
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-800'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 divide-x divide-slate-100 min-h-[420px]">
            {weekDays.map((d) => {
              const key = formatDateKey(d);
              const events = eventsByDate[key] || [];

              return (
                <div
                  key={key}
                  onClick={() => setInspectedDateKey(key)}
                  className="p-2 space-y-2 hover:bg-slate-50/60 transition-colors cursor-pointer"
                >
                  {events.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[11px] text-slate-300">
                      Empty
                    </div>
                  ) : (
                    events.map((ev) => {
                      const tone = EVENT_TONES[ev.kind] || EVENT_TONES.applied;
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ev.rawApplication) {
                              onSelectApplication(ev.rawApplication);
                            } else {
                              setInspectedDateKey(key);
                            }
                          }}
                          className={`p-2 rounded-md border text-xs space-y-1 transition-shadow hover:shadow-xs cursor-pointer ${tone.bg} ${tone.border}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[10px] font-semibold uppercase ${tone.text}`}>
                              {ev.kind}
                            </span>
                            {ev.timeStr && (
                              <span className="text-[10px] text-slate-500 font-mono-tabular">
                                {ev.timeStr}
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-slate-900 truncate">
                            {ev.company}
                          </p>
                          <p className="text-[11px] text-slate-600 truncate">
                            {ev.role_title}
                          </p>
                          {ev.meetingLink && (
                            <a
                              href={ev.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] text-indigo-700 font-medium underline"
                            >
                              <Video className="w-3 h-3" />
                              Join
                            </a>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Agenda View: Chronological list view ideal for 10+ bulk applications */
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {Object.keys(eventsByDate).length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CalendarDays className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-900">No events found</p>
              <p className="text-xs text-slate-500 mt-1">
                Try selecting &apos;All&apos; or adjusting your search term.
              </p>
            </div>
          ) : (
            Object.keys(eventsByDate)
              .sort()
              .map((dateKey) => {
                const dayEvents = eventsByDate[dateKey];
                const d = parseDateKey(dateKey);
                const isToday = dateKey === formatDateKey(new Date());

                return (
                  <div key={dateKey} className="p-4 flex flex-col md:flex-row md:items-start gap-4">
                    {/* Date column */}
                    <div className="md:w-44 shrink-0 flex items-center gap-2.5">
                      <div
                        className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center font-mono-tabular ${
                          isToday
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <span className="text-[10px] uppercase font-bold leading-tight">
                          {d.toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                        <span className="text-sm font-extrabold leading-tight">
                          {d.getDate()}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          {d.toLocaleDateString(undefined, { weekday: 'long' })}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                        </p>
                      </div>
                    </div>

                    {/* Events list */}
                    <div className="flex-1 space-y-2">
                      {dayEvents.map((ev) => {
                        const tone = EVENT_TONES[ev.kind] || EVENT_TONES.applied;
                        return (
                          <div
                            key={ev.id}
                            onClick={() => {
                              if (ev.rawApplication) {
                                onSelectApplication(ev.rawApplication);
                              } else {
                                setInspectedDateKey(dateKey);
                              }
                            }}
                            className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-shadow hover:shadow-xs ${tone.bg} ${tone.border}`}
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase ${tone.text}`}>
                                  {ev.kind}
                                </span>
                                {ev.timeStr && (
                                  <span className="text-xs font-semibold text-slate-700 font-mono-tabular">
                                    {ev.timeStr}
                                    {ev.timeEndStr ? ` – ${ev.timeEndStr}` : ''}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-semibold text-slate-900 truncate">
                                {ev.company}
                              </h4>
                              <p className="text-xs text-slate-600 truncate">
                                {ev.role_title}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {ev.meetingLink && (
                                <a
                                  href={ev.meetingLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  Join Meeting
                                </a>
                              )}
                              {ev.rawApplication && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectApplication(ev.rawApplication!);
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors"
                                >
                                  Details
                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* Apple-Style Day Inspector Drawer (Handles 10+ jobs gracefully) */}
      {inspectedDateKey && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  {inspectedDateLabel}
                </h3>
                <p className="text-xs text-slate-500 font-mono-tabular">
                  {inspectedEvents.length} {inspectedEvents.length === 1 ? 'event' : 'events'} recorded
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedDateKey(null)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Events List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {inspectedEvents.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-xs">No events on this date.</p>
                </div>
              ) : (
                inspectedEvents.map((ev) => {
                  const tone = EVENT_TONES[ev.kind] || EVENT_TONES.applied;
                  return (
                    <div
                      key={ev.id}
                      className={`p-3.5 rounded-lg border space-y-2 ${tone.bg} ${tone.border}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold rounded uppercase ${tone.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                          {tone.label}
                        </span>

                        {ev.timeStr && (
                          <span className="text-xs font-semibold text-slate-700 font-mono-tabular">
                            {ev.timeStr}
                            {ev.timeEndStr ? ` – ${ev.timeEndStr}` : ''}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">
                          {ev.company}
                        </h4>
                        <p className="text-xs text-slate-600">
                          {ev.role_title}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between gap-2">
                        {ev.meetingLink ? (
                          <a
                            href={ev.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                          >
                            <Video className="w-3.5 h-3.5" />
                            Join Video Call
                          </a>
                        ) : <div />}

                        {ev.rawApplication && (
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedDateKey(null);
                              onSelectApplication(ev.rawApplication!);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors"
                          >
                            Open Application
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setInspectedDateKey(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
