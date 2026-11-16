import React from 'react';
import {
  ArrowUpRight,
  Briefcase,
  Calendar,
  Check,
  Columns3,
  ExternalLink,
  Plus,
  RefreshCw,
  Trophy,
  Video,
  Zap,
} from 'lucide-react';
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
      {/* Executive Command Banner */}
      <div className="studio-card rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-[#234aff] shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#234aff]/10 text-[#234aff] text-xs font-bold border border-[#234aff]/20">
            <span className="w-2 h-2 rounded-full bg-[#234aff]" />
            Search Active
          </div>
          <span className="text-xs font-medium text-[#58554d]">
            <strong className="text-[#12141d] font-bold">{applications.length}</strong> active applications
            {' · '}
            <strong className="text-[#12141d] font-bold">{dashboard?.kpis.upcoming_interviews ?? 0}</strong> interviews scheduled
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {imapConnected && (
            <button
              type="button"
              onClick={onSyncInbox}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-[#12141d] bg-white border border-[#e5e3dc] hover:bg-[#f6f5f2] rounded-xl shadow-2xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Inbox
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAddApp}
            className="btn-cobalt inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl"
          >
            <Plus className="w-3.5 h-3.5" />
            Track Application
          </button>
        </div>
      </div>

      {/* 4 Disciplined KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Applications */}
        <div
          onClick={() => onNavigateTab('applications')}
          className="studio-card studio-card-interactive rounded-2xl p-5 relative overflow-hidden group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#58554d]">
              Active Pipeline
            </span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#eeece6] border border-[#e5e3dc] text-[#12141d] group-hover:text-[#234aff] group-hover:border-[#234aff]/40 transition-colors">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline justify-between">
            <div className="font-mono-tabular font-display text-4xl font-extrabold tracking-tight text-[#12141d]">
              {dashboard?.kpis.active_applications ?? 0}
            </div>
            <span className="text-[11px] font-mono-tabular text-[#58554d] bg-[#eeece6] px-2 py-0.5 rounded-md border border-[#e5e3dc] font-semibold">
              &lt; 10 days
            </span>
          </div>
          <div className="mt-2.5 text-xs text-[#58554d] flex items-center gap-1 group-hover:text-[#234aff] transition-colors font-medium">
            <span>View all active</span>
            <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>

        {/* Upcoming Interviews */}
        <div
          onClick={() => onNavigateTab('interviews')}
          className="studio-card studio-card-interactive rounded-2xl p-5 relative overflow-hidden group cursor-pointer border-t-2 border-t-[#234aff]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#234aff] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#234aff]" />
              Interviews
            </span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#234aff]/10 border border-[#234aff]/20 text-[#234aff]">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline justify-between">
            <div className="font-mono-tabular font-display text-4xl font-extrabold tracking-tight text-[#234aff]">
              {dashboard?.kpis.upcoming_interviews ?? 0}
            </div>
            <span className="text-[11px] font-mono-tabular text-[#234aff] bg-[#234aff]/10 px-2 py-0.5 rounded-md border border-[#234aff]/20 font-bold">
              Scheduled
            </span>
          </div>
          <div className="mt-2.5 text-xs text-[#234aff] flex items-center gap-1 group-hover:underline font-semibold">
            <span>Manage calendar</span>
            <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>

        {/* Offers Received */}
        <div
          onClick={() => onSelectStage('offer')}
          className="studio-card studio-card-interactive rounded-2xl p-5 relative overflow-hidden group cursor-pointer border-t-2 border-t-[#107e3e]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#107e3e] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#107e3e]" />
              Offers
            </span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#107e3e]/10 border border-[#107e3e]/20 text-[#107e3e]">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline justify-between">
            <div className="font-mono-tabular font-display text-4xl font-extrabold tracking-tight text-[#107e3e]">
              {dashboard?.kpis.offers ?? 0}
            </div>
            <span className="text-[11px] font-mono-tabular text-[#107e3e] bg-[#107e3e]/10 px-2 py-0.5 rounded-md border border-[#107e3e]/20 font-bold">
              Secured
            </span>
          </div>
          <div className="mt-2.5 text-xs text-[#107e3e] flex items-center gap-1 group-hover:underline font-semibold">
            <span>Inspect offers</span>
            <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>

        {/* Relevant Job Alerts */}
        <div
          onClick={() => onNavigateTab('alerts')}
          className="studio-card studio-card-interactive rounded-2xl p-5 relative overflow-hidden group cursor-pointer border-t-2 border-t-[#b46500]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#b46500] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#b46500]" />
              Job Matches
            </span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#b46500]/10 border border-[#b46500]/20 text-[#b46500]">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline justify-between">
            <div className="font-mono-tabular font-display text-4xl font-extrabold tracking-tight text-[#12141d]">
              {dashboard?.kpis.relevant_alerts ?? 0}
            </div>
            <span className="text-[11px] font-mono-tabular text-[#b46500] bg-[#b46500]/10 px-2 py-0.5 rounded-md border border-[#b46500]/20 font-bold">
              Last 3 days
            </span>
          </div>
          <div className="mt-2.5 text-xs text-[#58554d] flex items-center gap-1 group-hover:text-[#b46500] transition-colors font-medium">
            <span>Review matches</span>
            <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>
      </div>

      {/* Applications by Stage & Activity Pace */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-[#12141d] font-display">Application Pipeline</h2>
            <p className="text-xs text-[#58554d]">
              Funnel progression and application velocity over time.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBoard}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-[#234aff] bg-white border border-[#e5e3dc] hover:border-[#234aff]/40 hover:bg-[#f6f5f2] rounded-xl whitespace-nowrap transition-all shadow-2xs"
          >
            <Columns3 className="w-3.5 h-3.5" />
            Open Kanban Board
          </button>
        </div>

        {applications.length === 0 ? (
          <div className="studio-card rounded-2xl p-10 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-[#234aff]/10 border border-[#234aff]/20 text-[#234aff]">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#12141d] font-display">Your job pipeline is empty</h3>
            <p className="text-xs text-[#58554d] mt-1 max-w-md mx-auto">
              Connect your email to pull in applications and interviews automatically, or add a job manually to get started.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              {imapConnected ? (
                <button
                  type="button"
                  onClick={onSyncInbox}
                  className="btn-cobalt px-4 py-2 text-xs font-bold rounded-xl"
                >
                  Sync Inbox
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="btn-cobalt px-4 py-2 text-xs font-bold rounded-xl"
                >
                  Start Quick Setup
                </button>
              )}
              <button
                type="button"
                onClick={onOpenAddApp}
                className="px-4 py-2 text-xs font-bold text-[#12141d] border border-[#e5e3dc] hover:bg-[#f6f5f2] rounded-xl shadow-2xs transition-all"
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
        {/* Upcoming Interviews Card */}
        <section className="studio-card rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e3dc] bg-[#fcfbf9]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#234aff]" />
                <h2 className="text-sm font-bold tracking-tight text-[#12141d] font-display">Upcoming Interviews</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('interviews')}
                className="text-xs font-bold text-[#234aff] hover:underline whitespace-nowrap"
              >
                View All →
              </button>
            </div>

            {(dashboard?.upcoming_interviews || []).length === 0 ? (
              <div className="p-10 text-center text-xs text-[#8e8a7f]">
                No upcoming interviews detected yet.
              </div>
            ) : (
              <div className="divide-y divide-[#e5e3dc]">
                {dashboard?.upcoming_interviews.slice(0, 5).map((iv) => {
                  const companyInitials = iv.company.slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={iv.id}
                      className="px-6 py-4 flex items-center justify-between gap-3.5 hover:bg-[#f6f5f2]/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs bg-[#eeece6] border border-[#e5e3dc] text-[#12141d]">
                          {companyInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-[#12141d] truncate">
                            {iv.company} <span className="font-normal text-[#58554d]">· {iv.round_label}</span>
                          </div>
                          <div className="text-xs text-[#58554d] truncate mt-0.5">
                            {iv.role_title}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div className="font-mono-tabular text-xs font-semibold text-[#12141d] px-2.5 py-1 rounded-lg bg-[#eeece6] border border-[#e5e3dc]">
                          {iv.scheduled_at.replace('T', ' ')}
                        </div>
                        {iv.meeting_link && (
                          <a
                            href={iv.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-cobalt inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg shadow-xs whitespace-nowrap"
                          >
                            <Video className="w-3 h-3" />
                            Join
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Recommended Job Alerts Card */}
        <section className="studio-card rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e3dc] bg-[#fcfbf9]">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#b46500]" />
                <h2 className="text-sm font-bold tracking-tight text-[#12141d] font-display">
                  Recommended Job Alerts
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('alerts')}
                className="text-xs font-bold text-[#234aff] hover:underline whitespace-nowrap"
              >
                View All →
              </button>
            </div>

            {(dashboard?.suggested_alerts || []).length === 0 ? (
              <div className="p-10 text-center text-xs text-[#8e8a7f]">
                No relevant job alert titles received in the last 3 days. Check View All for older alerts or sync your inbox.
              </div>
            ) : (
              <div className="divide-y divide-[#e5e3dc]">
                {dashboard?.suggested_alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    title={alert.relevance_reason || undefined}
                    className="px-6 py-4 flex items-center justify-between gap-3.5 hover:bg-[#f6f5f2]/70 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="text-[13px] font-bold text-[#12141d] truncate">
                        {alert.job_title}
                      </div>
                      <div className="text-xs text-[#58554d] flex items-center gap-1.5 truncate">
                        <span className="font-bold text-[#234aff]">
                          {alert.source_app}
                        </span>
                        {alert.company_name && (
                          <>
                            <span aria-hidden="true" className="text-[#e5e3dc]">·</span>
                            <span>{alert.company_name}</span>
                          </>
                        )}
                        <span aria-hidden="true" className="text-[#e5e3dc]">·</span>
                        <span className="font-mono-tabular px-2 py-0.5 rounded-full bg-[#107e3e]/10 border border-[#107e3e]/20 text-[#107e3e] text-[11px] font-bold">
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
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-[#12141d] border border-[#e5e3dc] bg-white hover:bg-[#f6f5f2] rounded-lg whitespace-nowrap shadow-2xs transition-colors"
                        >
                          Open
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onUpdateAlertStatus(alert.id, 'applied')}
                        className="btn-cobalt inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 shadow-2xs"
                      >
                        <Check className="w-3 h-3" />
                        Apply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
