import React from 'react';
import {
  BarChart3,
  Briefcase,
  Calendar,
  Columns3,
  Inbox,
  LayoutDashboard,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { describeCron, formatLocalDateTime, formatLocalDateTimeTooltip } from '../utils/appHelpers';
import type { ImapStatus } from '../types';

export type NavTab =
  | 'overview'
  | 'stats'
  | 'applications'
  | 'interviews'
  | 'alerts'
  | 'scans'
  | 'profile';

export const NAV_ITEMS: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'applications', label: 'Applications', icon: Columns3 },
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
}) => {
  return (
    <aside
      aria-hidden={!sidebarOpen}
      className={`shrink-0 bg-white overflow-hidden transition-[width,opacity] duration-200 ease-in-out ${
        sidebarOpen
          ? 'w-60 border-r border-slate-200 opacity-100'
          : 'w-0 border-r-0 opacity-0 pointer-events-none'
      }`}
    >
      <div className="w-60 h-full min-h-screen flex flex-col justify-between">
        <div>
          <div className="h-14 pl-5 pr-3 flex items-center justify-between border-b border-slate-200">
            <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Job Tracker
            </span>
            <button
              type="button"
              onClick={onToggleSidebar}
              title="Close sidebar"
              aria-label="Close sidebar"
              aria-expanded={sidebarOpen}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
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
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.id === 'alerts' && relevantAlertsCount > 0 && (
                    <span className="font-mono-tabular text-[11px] text-blue-700">
                      {relevantAlertsCount}
                    </span>
                  )}
                  {item.id === 'interviews' && upcomingInterviewsCount > 0 && (
                    <span className="font-mono-tabular text-[11px] text-slate-500">
                      {upcomingInterviewsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3.5 border-t border-slate-200 space-y-2.5">
          {imap?.connected ? (
            <div className="space-y-2">
              <div className="text-xs">
                <div className="font-medium text-slate-900 capitalize truncate">
                  {imap.provider === 'custom' ? 'Email' : imap.provider}
                </div>
                <div className="text-slate-500 truncate">{imap.email}</div>
              </div>
              <button
                type="button"
                onClick={onOpenImapModal}
                className="w-full px-2.5 py-1.5 text-[11px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded whitespace-nowrap"
              >
                Change Email
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Connect your email to automatically track job replies and interviews.
              </p>
              <button
                type="button"
                onClick={onOpenImapModal}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md whitespace-nowrap"
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
    <header className="h-14 px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-8">
      <div className="flex items-center gap-3 min-w-0">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Open sidebar"
            aria-label="Open sidebar"
            aria-expanded={false}
            className="p-1.5 -ml-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="font-display text-base font-semibold text-slate-900 whitespace-nowrap shrink-0">
            {activeNavTitle}
          </h1>
          {lastSyncAt && (
            <span
              title={formatLocalDateTimeTooltip(lastSyncAt)}
              className="hidden sm:inline text-xs text-slate-500 font-mono-tabular truncate"
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
              className="hidden md:inline text-xs text-blue-700 whitespace-nowrap"
            >
              Auto-sync: {describeCron(autoSyncCron)}
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
          className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700 focus:border-blue-600 focus:outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 180 days</option>
        </select>

        <button
          type="button"
          onClick={onOpenAddApp}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Job
        </button>

        {imapConnected ? (
          <button
            type="button"
            onClick={onSyncInbox}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Inbox'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenImapModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md whitespace-nowrap shrink-0"
          >
            <Mail className="w-3.5 h-3.5" />
            Connect Email
          </button>
        )}
      </div>
    </header>
  );
};
