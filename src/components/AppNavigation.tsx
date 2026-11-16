import React from 'react';
import {
  BarChart3,
  Briefcase,
  Calendar,
  CalendarDays,
  Columns3,
  Inbox,
  LayoutDashboard,
  Mail,
  Moon,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { describeCron, formatLocalDateTime, formatLocalDateTimeTooltip } from '../utils/appHelpers';
import type { ImapStatus } from '../types';

export type ThemeMode = 'light' | 'dark' | 'system';

export type NavTab =
  | 'overview'
  | 'stats'
  | 'applications'
  | 'calendar'
  | 'interviews'
  | 'alerts'
  | 'scans'
  | 'profile';

export const NAV_ITEMS: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'applications', label: 'Applications', icon: Columns3 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'interviews', label: 'Interviews', icon: Calendar },
  { id: 'alerts', label: 'Job Alerts', icon: Briefcase },
  { id: 'scans', label: 'Scanned Emails', icon: Inbox },
  { id: 'profile', label: 'Settings', icon: SlidersHorizontal },
];

export interface AppSidebarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  relevantAlertsCount: number;
  upcomingInterviewsCount: number;
  imap?: ImapStatus | null;
  onOpenImapModal: () => void;
  theme?: ThemeMode;
  onSelectTheme?: (theme: ThemeMode) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  sidebarOpen,
  onToggleSidebar,
  activeTab,
  onSelectTab,
  relevantAlertsCount,
  upcomingInterviewsCount,
  imap,
  onOpenImapModal,
  theme = 'system',
  onSelectTheme,
}) => {
  return (
    <aside
      aria-hidden={!sidebarOpen}
      className={`shrink-0 bg-[#fcfbf9] dark:bg-[#111622] overflow-hidden transition-[width,opacity] duration-200 ease-in-out ${
        sidebarOpen
          ? 'w-60 border-r border-[#e5e3dc] dark:border-slate-800/90 opacity-100'
          : 'w-0 border-r-0 opacity-0 pointer-events-none'
      }`}
    >
      <div className="w-60 h-full min-h-screen flex flex-col justify-between">
        <div>
          <div className="h-14 pl-4 pr-3 flex items-center justify-between border-b border-[#e5e3dc] dark:border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#234aff] flex items-center justify-center text-white shadow-xs font-display font-bold text-sm tracking-tight">
                JT
              </div>
              <div className="flex flex-col">
                <span className="font-display text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-none">
                  Job Tracker
                </span>
                <span className="text-[10px] text-stone-400 dark:text-slate-500 font-mono tracking-tight mt-0.5">
                  v2.0 · personal
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleSidebar}
              title="Close sidebar"
              aria-label="Close sidebar"
              aria-expanded={sidebarOpen}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-[#eeece6] dark:hover:bg-slate-800/60 transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-[13px] rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#234aff]/10 dark:bg-blue-950/40 text-[#234aff] dark:text-blue-400 font-semibold border-l-[3px] border-[#234aff] dark:border-blue-500 pl-2.5'
                      : 'text-stone-600 dark:text-slate-400 hover:bg-[#eeece6]/60 dark:hover:bg-slate-800/50 hover:text-stone-900 dark:hover:text-slate-200 font-medium border-l-[3px] border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#234aff] dark:text-blue-400' : 'text-stone-400 dark:text-slate-500'}`} />
                    <span>{item.label}</span>
                  </span>
                  {item.id === 'alerts' && relevantAlertsCount > 0 && (
                    <span className="font-mono-tabular text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#234aff]/10 dark:bg-blue-900/60 text-[#234aff] dark:text-blue-300">
                      {relevantAlertsCount}
                    </span>
                  )}
                  {item.id === 'interviews' && upcomingInterviewsCount > 0 && (
                    <span className="font-mono-tabular text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#eeece6] dark:bg-slate-800 text-stone-700 dark:text-slate-400">
                      {upcomingInterviewsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-[#e5e3dc] dark:border-slate-800/80 space-y-3">
          {/* Theme switcher */}
          <div className="flex items-center justify-between bg-[#eeece6]/80 dark:bg-slate-900/80 rounded-lg p-1 border border-[#e5e3dc] dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => onSelectTheme?.('light')}
              title="Light theme"
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-medium rounded-md transition-colors ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectTheme?.('dark')}
              title="Dark theme"
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-medium rounded-md transition-colors ${
                theme === 'dark'
                  ? 'bg-[#1c2436] text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectTheme?.('system')}
              title="Follow system theme"
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-medium rounded-md transition-colors ${
                theme === 'system'
                  ? 'bg-white dark:bg-[#1c2436] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Auto</span>
            </button>
          </div>

          {imap?.connected ? (
            <div className="p-2.5 rounded-lg bg-[#f6f5f2] dark:bg-slate-900/50 border border-[#e5e3dc] dark:border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                    {imap.provider === 'custom' ? 'Email' : imap.provider}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenImapModal}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Configure
                </button>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {imap.email}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Connect your inbox to automatically track job replies & calendar invites.
              </p>
              <button
                type="button"
                onClick={onOpenImapModal}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#234aff] hover:bg-[#1938d8] rounded-lg shadow-xs transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                Connect Email
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export interface AppHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeNavTitle: string;
  lastSyncAt?: string | null;
  autoSyncEnabled?: boolean;
  autoSyncCron?: string;
  nextAutoSyncAt?: string | null;
  syncDays: number;
  onChangeSyncDays: (days: number) => void;
  onOpenAddApp: () => void;
  imapConnected: boolean;
  syncing: boolean;
  onSyncInbox: () => void;
  onOpenImapModal: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  sidebarOpen,
  onToggleSidebar,
  activeNavTitle,
  lastSyncAt,
  autoSyncEnabled,
  autoSyncCron,
  nextAutoSyncAt,
  syncDays,
  onChangeSyncDays,
  onOpenAddApp,
  imapConnected,
  syncing,
  onSyncInbox,
  onOpenImapModal,
}) => {
  return (
    <header className="h-14 px-6 bg-[#fcfbf9] dark:bg-[#111622] border-b border-[#e5e3dc] dark:border-slate-800/90 flex items-center justify-between gap-6 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Open sidebar"
            aria-label="Open sidebar"
            aria-expanded={false}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-[#eeece6] dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap shrink-0">
            {activeNavTitle}
          </h1>
          {lastSyncAt && (
            <span
              title={formatLocalDateTimeTooltip(lastSyncAt)}
              className="hidden sm:inline text-xs text-stone-400 dark:text-slate-500 font-mono-tabular truncate"
            >
              Last sync {formatLocalDateTime(lastSyncAt)}
            </span>
          )}
          {autoSyncEnabled && autoSyncCron && (
            <span
              title={
                nextAutoSyncAt
                  ? `Schedule: ${autoSyncCron} · Next run: ${new Date(nextAutoSyncAt).toLocaleString()}`
                  : `Schedule: ${autoSyncCron}`
              }
              className="hidden md:inline text-xs text-[#234aff] dark:text-blue-400 font-medium whitespace-nowrap"
            >
              Auto: {describeCron(autoSyncCron)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <select
          aria-label="Email time range"
          title="How far back to check emails"
          value={syncDays}
          onChange={(e) => onChangeSyncDays(Number(e.target.value))}
          className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700/80 rounded-lg text-slate-700 dark:text-slate-300 focus:border-[#234aff] focus:outline-none shadow-2xs"
        >
          <option value={1}>Last 1 day</option>
          <option value={3}>Last 3 days</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>

        <button
          type="button"
          onClick={onOpenAddApp}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#182030] border border-[#e5e3dc] dark:border-slate-700/80 hover:bg-[#f6f5f2] dark:hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 shadow-2xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Job
        </button>

        {imapConnected ? (
          <button
            type="button"
            onClick={onSyncInbox}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#234aff] hover:bg-[#1938d8] rounded-lg whitespace-nowrap shrink-0 disabled:opacity-60 shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Inbox'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenImapModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#234aff] hover:bg-[#1938d8] rounded-lg whitespace-nowrap shrink-0 shadow-xs transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Connect Email
          </button>
        )}
      </div>
    </header>
  );
};
