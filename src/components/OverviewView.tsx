import React from 'react';
import { Check, Columns3, ExternalLink } from 'lucide-react';
import { ApplicationPaceCard, ApplicationsByStageCard } from './PipelineActivityCards';
import type {
  Application,
  ApplicationStatus,
  DashboardSummary,
  JobAlertStatus,
  StatsSummary,
} from '../types';

export interface OverviewViewProps {
  dashboard: DashboardSummary | null;
  overviewStats: StatsSummary | null;
  applications: Application[];
  imapConnected: boolean;
  overviewPaceMode: 'daily' | 'weekly';
  onChangePaceMode: (mode: 'daily' | 'weekly') => void;
  onOpenBoard: () => void;
  onSelectStage: (stage: ApplicationStatus) => void;
  onSyncInbox: () => void;
  onOpenOnboarding: () => void;
  onOpenAddApp: () => void;
  onNavigateTab: (tab: 'applications' | 'interviews' | 'alerts') => void;
  onUpdateAlertStatus: (id: number, status: JobAlertStatus) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  dashboard,
  overviewStats,
  applications,
  imapConnected,
  overviewPaceMode,
  onChangePaceMode,
  onOpenBoard,
  onSelectStage,
  onSyncInbox,
  onOpenOnboarding,
  onOpenAddApp,
  onNavigateTab,
  onUpdateAlertStatus,
}) => {
  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Applications */}
        <div className="relative rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] p-4 overflow-hidden shadow-2xs hover:shadow-xs transition-shadow">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-slate-400 dark:bg-slate-500" />
          <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
            Active Applications <span className="text-slate-400 dark:text-slate-500 font-normal">(&lt; 10d)</span>
          </div>
          <div className="mt-1.5 font-mono-tabular text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {dashboard?.kpis.active_applications ?? 0}
          </div>
        </div>

        {/* Upcoming Interviews */}
        <div className="relative rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] p-4 overflow-hidden shadow-2xs hover:shadow-xs transition-shadow">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-blue-600 dark:bg-blue-500" />
          <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Upcoming Interviews</div>
          <div className="mt-1.5 font-mono-tabular text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {dashboard?.kpis.upcoming_interviews ?? 0}
          </div>
        </div>

        {/* Offers Received */}
        <div className="relative rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] p-4 overflow-hidden shadow-2xs hover:shadow-xs transition-shadow">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-emerald-600 dark:bg-emerald-500" />
          <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Offers Received</div>
          <div className="mt-1.5 font-mono-tabular text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {dashboard?.kpis.offers ?? 0}
          </div>
        </div>

        {/* Relevant Job Alerts */}
        <div className="relative rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] p-4 overflow-hidden shadow-2xs hover:shadow-xs transition-shadow">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-500 dark:bg-amber-400" />
          <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
            Relevant Job Alerts <span className="text-slate-400 dark:text-slate-500 font-normal">(Last 3d)</span>
          </div>
          <div className="mt-1.5 font-mono-tabular text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {dashboard?.kpis.relevant_alerts ?? 0}
          </div>
        </div>
      </div>

      {/* Applications by Stage & Activity Pace */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">Application Pipeline</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Stage distribution and application pace. Open the full board to drag cards across stages.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBoard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg whitespace-nowrap transition-colors"
          >
            <Columns3 className="w-3.5 h-3.5" />
            Open Application Board
          </button>
        </div>

        {applications.length === 0 ? (
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] p-10 text-center shadow-2xs">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Your job pipeline is empty</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Connect your email to pull in job replies and interviews automatically, or add a job by hand.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              {imapConnected ? (
                <button
                  type="button"
                  onClick={onSyncInbox}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
                >
                  Sync Inbox
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
                >
                  Start Quick Setup
                </button>
              )}
              <button
                type="button"
                onClick={onOpenAddApp}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg shadow-2xs transition-colors"
              >
                Add Job
              </button>
            </div>
          </div>
        ) : overviewStats ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ApplicationsByStageCard
              funnel={overviewStats.funnel}
              onSelectStage={onSelectStage}
            />

            <ApplicationPaceCard
              dailyPace={overviewStats.daily_pace}
              dailyPaceSummary={overviewStats.daily_pace_summary}
              weeklyPace={overviewStats.weekly_pace}
              weeklyPaceSummary={overviewStats.pace_summary}
              paceMode={overviewPaceMode}
              onChangePaceMode={onChangePaceMode}
            />
          </div>
        ) : null}
      </section>

      {/* Lower Two-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80">
            <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">Upcoming Interviews</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('interviews')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 whitespace-nowrap"
            >
              View All
            </button>
          </div>

          {(dashboard?.upcoming_interviews || []).length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
              No upcoming interviews detected yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {dashboard?.upcoming_interviews.slice(0, 5).map((iv) => (
                <div
                  key={iv.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {iv.company} · {iv.round_label}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {iv.role_title}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="font-mono-tabular text-xs font-medium text-slate-700 dark:text-slate-300">
                      {iv.scheduled_at.replace('T', ' ')}
                    </div>
                    {iv.meeting_link && (
                      <a
                        href={iv.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Join Call
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926] overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80">
            <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Recommended Job Alert Titles{' '}
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(Last 3 days)</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('alerts')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 whitespace-nowrap"
            >
              View All
            </button>
          </div>

          {(dashboard?.suggested_alerts || []).length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
              No relevant job alert titles received in the last 3 days. Check View All for older alerts or sync your inbox.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {dashboard?.suggested_alerts.slice(0, 6).map((alert) => (
                <div
                  key={alert.id}
                  title={alert.relevance_reason || undefined}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {alert.job_title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        From {alert.source_app}
                      </span>
                      {alert.company_name && (
                        <>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                          <span>{alert.company_name}</span>
                        </>
                      )}
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-mono-tabular px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                        {alert.relevance_score}% match
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {alert.job_url && (
                      <a
                        href={alert.job_url}
                        target="_blank"
                        rel="noreferrer"
                        title="Open job listing"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap shadow-2xs"
                      >
                        Open
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onUpdateAlertStatus(alert.id, 'applied')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg whitespace-nowrap shrink-0 shadow-2xs transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
