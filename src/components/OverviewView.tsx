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
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
          <div className="text-xs font-medium text-slate-500">
            Active Applications <span className="text-slate-400 font-normal">(&lt; 10d)</span>
          </div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
            {dashboard?.kpis.active_applications ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
          <div className="text-xs font-medium text-slate-500">Upcoming Interviews</div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-blue-600">
            {dashboard?.kpis.upcoming_interviews ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
          <div className="text-xs font-medium text-slate-500">Offers Received</div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-emerald-700">
            {dashboard?.kpis.offers ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
          <div className="text-xs font-medium text-slate-500">
            Relevant Job Alerts <span className="text-slate-400 font-normal">(Last 3d)</span>
          </div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
            {dashboard?.kpis.relevant_alerts ?? 0}
          </div>
        </div>
      </div>

      {/* Applications by Stage & Activity Pace */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Application Pipeline</h2>
            <p className="text-xs text-slate-500">
              Stage distribution and application pace. Open the full board to drag cards across stages.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBoard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md whitespace-nowrap"
          >
            <Columns3 className="w-3.5 h-3.5" />
            Open Application Board
          </button>
        </div>

        {applications.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <h3 className="text-sm font-semibold text-slate-900">Your job pipeline is empty</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Connect your email to pull in job replies and interviews automatically, or add a job by hand.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              {imapConnected ? (
                <button
                  type="button"
                  onClick={onSyncInbox}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Sync Inbox
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Start Quick Setup
                </button>
              )}
              <button
                type="button"
                onClick={onOpenAddApp}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md"
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
        <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming Interviews</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('interviews')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              View All
            </button>
          </div>

          {(dashboard?.upcoming_interviews || []).length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No upcoming interviews detected yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dashboard?.upcoming_interviews.slice(0, 5).map((iv) => (
                <div
                  key={iv.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {iv.company} · {iv.round_label}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {iv.role_title}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="font-mono-tabular text-xs font-medium text-slate-900">
                      {iv.scheduled_at.replace('T', ' ')}
                    </div>
                    {iv.meeting_link && (
                      <a
                        href={iv.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
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

        <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Recommended Job Alert Titles{' '}
              <span className="text-xs font-normal text-slate-500">(Last 3 days)</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('alerts')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              View All
            </button>
          </div>

          {(dashboard?.suggested_alerts || []).length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No relevant job alert titles received in the last 3 days. Check View All for older alerts or sync your inbox.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dashboard?.suggested_alerts.slice(0, 6).map((alert) => (
                <div
                  key={alert.id}
                  title={alert.relevance_reason || undefined}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {alert.job_title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                      <span className="font-medium text-blue-700">
                        From {alert.source_app}
                      </span>
                      {alert.company_name && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{alert.company_name}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {alert.relevance_score}% match
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {alert.job_url && (
                      <a
                        href={alert.job_url}
                        target="_blank"
                        rel="noreferrer"
                        title="Open job listing"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 rounded whitespace-nowrap"
                      >
                        Open
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onUpdateAlertStatus(alert.id, 'applied')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded whitespace-nowrap shrink-0"
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
