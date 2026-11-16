import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
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
  applied: 'border-l-slate-400 dark:border-l-slate-500',
  interviewing: 'border-l-blue-600 dark:border-l-blue-500',
  offer: 'border-l-emerald-600 dark:border-l-emerald-500',
  rejected: 'border-l-rose-500 dark:border-l-rose-500',
  ghosted: 'border-l-amber-500 dark:border-l-amber-400',
};

const STAGE_DOT_COLORS: Record<ApplicationStatus, string> = {
  applied: 'bg-slate-400 dark:bg-slate-500',
  interviewing: 'bg-blue-600 dark:bg-blue-500',
  offer: 'bg-emerald-600 dark:bg-emerald-500',
  rejected: 'bg-rose-500 dark:bg-rose-500',
  ghosted: 'bg-amber-500 dark:bg-amber-400',
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  applications,
  onMoveStage,
  onSelectApplication,
  compact = false,
}) => {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ApplicationStatus | null>(null);

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
        const visibleItems = compact ? items.slice(0, 5) : items;
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
            className={`flex flex-col rounded-xl border transition-all min-h-[260px] ${
              isOver
                ? 'border-dashed border-2 border-blue-500/80 bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-slate-200/80 dark:border-slate-800/80 bg-slate-100/50 dark:bg-[#0e1420]/60'
            }`}
          >
            <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-[#131926]/90 backdrop-blur-xs rounded-t-xl">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${STAGE_DOT_COLORS[stage.key]}`} />
                <span className="text-xs font-semibold tracking-tight text-slate-800 dark:text-slate-200">
                  {stage.label}
                </span>
              </div>
              <span className="font-mono-tabular text-xs font-medium text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80">
                {items.length}
              </span>
            </div>

            <div className="flex-1 p-2 space-y-2.5">
              {visibleItems.length === 0 ? (
                <div className="h-28 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 text-center px-2">
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
                    className={`group cursor-pointer rounded-xl border border-slate-200/80 dark:border-slate-800/80 border-l-[3.5px] ${
                      STAGE_BAR_COLORS[app.status]
                    } bg-white dark:bg-[#151c2a] p-3 shadow-2xs hover:shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all ${
                      draggedId === app.id ? 'opacity-40 scale-95' : ''
                    }`}
                  >
                    <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                      {app.role_title}
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                      {app.company}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {app.source_platform && <span>{app.source_platform}</span>}
                      {app.source_platform && app.last_update_date && (
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
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
                      className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/70 flex items-center justify-between gap-2"
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
                        className="flex-1 min-w-0 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#1a2233] border border-slate-200 dark:border-slate-700/80 rounded-md px-2 py-1 focus:outline-none focus:border-blue-500"
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
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md border border-slate-200 dark:border-slate-700 shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}

              {compact && items.length > 5 && (
                <div className="text-center py-1 text-[11px] text-slate-400 dark:text-slate-500 font-mono-tabular">
                  +{items.length - 5} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
