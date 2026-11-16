import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { APPLICATION_STAGES } from '../api';
import type { Application, ApplicationStatus } from '../types';
import { getDaysSinceUpdate, isStaleApplication } from '../utils/appHelpers';

interface KanbanBoardProps {
  applications: Application[];
  onMoveStage: (appId: number, status: ApplicationStatus) => Promise<void>;
  onSelectApplication: (app: Application) => void;
  compact?: boolean;
}

const STAGE_BAR_COLORS: Record<ApplicationStatus, string> = {
  applied: 'border-l-[#4f46e5]',
  interviewing: 'border-l-[#234aff]',
  offer: 'border-l-[#107e3e]',
  rejected: 'border-l-[#be123c]',
  ghosted: 'border-l-[#78716c]',
};

const STAGE_DOT_COLORS: Record<ApplicationStatus, string> = {
  applied: 'bg-[#4f46e5]',
  interviewing: 'bg-[#234aff]',
  offer: 'bg-[#107e3e]',
  rejected: 'bg-[#be123c]',
  ghosted: 'bg-[#78716c]',
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  applications,
  onMoveStage,
  onSelectApplication,
  compact = false,
}) => {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ApplicationStatus | null>(null);
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});

  const handleDrop = async (e: React.DragEvent, targetStage: ApplicationStatus) => {
    e.preventDefault();
    setDragOverStage(null);
    const rawId = e.dataTransfer.getData('text/plain');
    const appId = Number(rawId || draggedId);
    setDraggedId(null);
    if (!appId) return;
    const current = applications.find((a) => a.id === appId);
    if (!current || current.status === targetStage) return;
    await onMoveStage(appId, targetStage);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
      {APPLICATION_STAGES.map((stage) => {
        const items = applications.filter((a) => a.status === stage.key);
        const maxCards = 5;
        const isExpanded = Boolean(expandedStages[stage.key]);
        const hasMore = items.length > maxCards;
        const visibleItems = compact
          ? items.slice(0, 5)
          : isExpanded
          ? items
          : items.slice(0, maxCards);
        const isOver = dragOverStage === stage.key;

        return (
          <div
            key={stage.key}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverStage !== stage.key) setDragOverStage(stage.key);
            }}
            onDragLeave={() => {
              if (dragOverStage === stage.key) setDragOverStage(null);
            }}
            onDrop={(e) => handleDrop(e, stage.key)}
            className={`flex flex-col rounded-2xl border transition-all min-h-[300px] ${
              isOver
                ? 'border-dashed border-2 border-[#234aff] bg-[#234aff]/5'
                : stage.key === 'interviewing'
                ? 'border-[#e5e3dc] dark:border-slate-800 bg-[#eeece6]/60 dark:bg-[#0e1420]/60 border-t-2 border-t-[#234aff]'
                : 'border-[#e5e3dc] dark:border-slate-800 bg-[#eeece6]/60 dark:bg-[#0e1420]/60'
            }`}
          >
            <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#e5e3dc] dark:border-slate-800 bg-white dark:bg-[#131926] rounded-t-2xl">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${STAGE_DOT_COLORS[stage.key]}`} />
                <span className="text-xs font-bold tracking-tight text-[#12141d] dark:text-slate-200">
                  {stage.label}
                </span>
              </div>
              <span className="font-mono-tabular text-xs font-bold text-[#58554d] dark:text-slate-400 px-2 py-0.5 rounded-md bg-[#eeece6] dark:bg-slate-800 border border-[#e5e3dc] dark:border-slate-700">
                {items.length}
              </span>
            </div>

            <div className="flex-1 p-2 space-y-2.5">
              {visibleItems.length === 0 ? (
                <div className="h-28 flex items-center justify-center text-xs text-[#8e8a7f] dark:text-slate-500 text-center px-2">
                  No applications in {stage.label.toLowerCase()}
                </div>
              ) : (
                visibleItems.map((app) => (
                  <div
                    key={app.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedId(app.id);
                      e.dataTransfer.setData('text/plain', String(app.id));
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverStage(null);
                    }}
                    onClick={() => onSelectApplication(app)}
                    className={`group cursor-pointer rounded-xl border border-[#e5e3dc] dark:border-slate-800 border-l-[3.5px] ${
                      STAGE_BAR_COLORS[app.status]
                    } bg-white dark:bg-[#151c2a] p-3 shadow-2xs hover:shadow-xs hover:border-[#234aff]/40 transition-all ${
                      draggedId === app.id ? 'opacity-40 scale-95' : ''
                    }`}
                  >
                    <div className="text-[13px] font-bold text-[#12141d] dark:text-slate-100 leading-snug line-clamp-2">
                      {app.role_title}
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#58554d] dark:text-slate-300 truncate">
                      {app.company}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[#8e8a7f] dark:text-slate-400">
                      {app.source_platform && <span>{app.source_platform}</span>}
                      {app.source_platform && app.last_update_date && (
                        <span aria-hidden="true" className="text-[#e5e3dc] dark:text-slate-600">·</span>
                      )}
                      {app.last_update_date && (
                        <span className="font-mono-tabular">{app.last_update_date}</span>
                      )}
                      {isStaleApplication(app) && (
                        <span className="font-mono-tabular font-medium text-amber-600 dark:text-amber-400">
                          · {getDaysSinceUpdate(app)}d stale
                        </span>
                      )}
                    </div>

                    <div
                      className="mt-2.5 pt-2 border-t border-[#e5e3dc]/80 dark:border-slate-800/70 flex items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="sr-only" htmlFor={`stage-${app.id}`}>
                        Move stage
                      </label>
                      <select
                        id={`stage-${app.id}`}
                        value={app.status}
                        onChange={(e) =>
                          onMoveStage(app.id, e.target.value as ApplicationStatus)
                        }
                        className="flex-1 min-w-0 text-[11px] font-medium text-[#12141d] dark:text-slate-300 bg-[#f6f5f2] dark:bg-[#1a2233] border border-[#e5e3dc] dark:border-slate-700/80 rounded-lg px-2 py-1 focus:outline-none focus:border-[#234aff]"
                      >
                        {APPLICATION_STAGES.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {app.job_url && (
                        <a
                          href={app.job_url}
                          target="_blank"
                          rel="noreferrer"
                          title="Open job or application portal link"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-[#234aff] hover:bg-[#234aff]/10 rounded-lg border border-[#e5e3dc] dark:border-slate-700 shrink-0 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}

              {compact && items.length > 5 && (
                <div className="text-center py-1 text-[11px] text-[#8e8a7f] dark:text-slate-500 font-mono-tabular">
                  +{items.length - 5} more
                </div>
              )}

              {!compact && hasMore && (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedStages((prev) => ({
                      ...prev,
                      [stage.key]: !prev[stage.key],
                    }))
                  }
                  className="w-full mt-1.5 py-2 px-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-[#58554d] hover:text-[#234aff] bg-white hover:bg-[#f6f5f2] border border-[#e5e3dc] hover:border-[#234aff]/40 rounded-xl transition-all shadow-2xs"
                >
                  {isExpanded ? (
                    <>
                      <span>Show fewer</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>+{items.length - maxCards} more</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
