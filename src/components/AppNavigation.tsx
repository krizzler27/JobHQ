import React from 'react';
import {
  BarChart3,
  Briefcase,
  Calendar,
  CalendarDays,
  ChevronDown,
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
import { LookbackDropdown } from './LookbackDropdown';
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
      className={`h-full max-h-full overflow-hidden shrink-0 bg-[#fcfbf9] dark:bg-[#111622] border-r border-[#e5e3dc] dark:border-slate-800/90 transition-[width] duration-200 ease-in-out z-30 flex flex-col justify-between ${
        sidebarOpen ? 'w-60' : 'w-16'
      }`}
    >
      {/* Top Header / Logo */}
      {sidebarOpen ? (
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#e5e3dc] dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/img/Logo Icon Light No BG.png"
              alt="JobHQ Logo"
              className="w-7 h-7 object-contain shrink-0"
            />
            <img
              src="/img/Logo Text Light No BG.png"
              alt="JobHQ"
              className="h-6.5 w-auto object-contain shrink-0"
            />
          </div>
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            aria-expanded={true}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-[#eeece6] dark:hover:bg-slate-800/60 transition-colors shrink-0 cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="h-14 flex items-center justify-center border-b border-[#e5e3dc] dark:border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            aria-expanded={false}
            className="relative w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#eeece6]/80 dark:hover:bg-slate-800/60 transition-colors group cursor-pointer"
          >
            <img
              src="/img/Logo Icon Light No BG.png"
              alt="JobHQ"
              className="w-7 h-7 object-contain transition-opacity duration-150 group-hover:opacity-0"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[#234aff]">
              <PanelLeftOpen className="w-5 h-5" />
            </div>
          </button>
        </div>
      )}

      {/* Navigation Links */}
      <div className="overflow-y-auto min-h-0 flex-1">
        {sidebarOpen ? (
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
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? 'text-[#234aff] dark:text-blue-400'
                          : 'text-stone-400 dark:text-slate-500'
                      }`}
                    />
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
        ) : (
          <nav className="p-2 space-y-1.5 flex flex-col items-center">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  title={item.label}
                  aria-label={item.label}
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-[#234aff] text-white shadow-xs'
                      : 'text-stone-500 dark:text-slate-400 hover:bg-[#eeece6] dark:hover:bg-slate-800/60 hover:text-stone-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.id === 'alerts' && relevantAlertsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#234aff] ring-2 ring-[#fcfbf9] dark:ring-[#111622]" />
                  )}
                  {item.id === 'interviews' && upcomingInterviewsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#fcfbf9] dark:ring-[#111622]" />
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Bottom Section */}
      {sidebarOpen ? (
        <div className="p-3 border-t border-[#e5e3dc] dark:border-slate-800/80 shrink-0">
          {imap?.connected ? (
            <div className="studio-card p-3 rounded-xl space-y-2 border border-[#e5e3dc] dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 shrink-0" />
                  <span className="font-semibold text-stone-900 dark:text-slate-100 capitalize truncate text-xs">
                    {imap.provider === 'custom' ? 'Email' : imap.provider}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenImapModal}
                  className="text-[11px] font-semibold text-[#234aff] hover:underline shrink-0"
                >
                  Configure
                </button>
              </div>
              <div
                title={imap.email}
                className="text-[11px] font-mono-tabular text-stone-500 dark:text-slate-400 truncate max-w-full"
              >
                {imap.email}
              </div>
            </div>
          ) : (
            <div className="studio-card p-3 rounded-xl space-y-2 border border-[#e5e3dc] dark:border-slate-800">
              <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-snug">
                Connect your inbox to track applications &amp; interviews.
              </p>
              <button
                type="button"
                onClick={onOpenImapModal}
                className="btn-cobalt w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg shadow-xs"
              >
                <Mail className="w-3.5 h-3.5" />
                Connect Email
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="p-2 border-t border-[#e5e3dc] dark:border-slate-800/80 flex flex-col items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenImapModal}
            title={imap?.connected ? `Connected: ${imap.email}` : 'Connect Email'}
            aria-label="Email settings"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center text-stone-500 dark:text-slate-400 hover:bg-[#eeece6] dark:hover:bg-slate-800/60 hover:text-stone-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            {imap?.connected ? (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#fcfbf9] dark:ring-[#111622]" />
            ) : (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-[#fcfbf9] dark:ring-[#111622]" />
            )}
          </button>
        </div>
      )}
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
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="font-display text-base font-semibold text-stone-900 dark:text-slate-100 tracking-tight whitespace-nowrap shrink-0">
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
        <LookbackDropdown
          value={syncDays}
          disabled={syncing}
          onChange={onChangeSyncDays}
        />

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
