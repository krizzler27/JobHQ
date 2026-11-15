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
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
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
            className={`flex flex-col rounded-lg border transition-colors min-h-[240px] ${
              isOver
                ? 'border-blue-500 bg-blue-50/40'
                : 'border-slate-200 bg-slate-50/80'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 bg-white rounded-t-lg">
              <span className={`text-xs font-semibold tracking-tight ${stage.tone}`}>
                {stage.label}
              </span>
              <span className="font-mono-tabular text-xs font-medium text-slate-500">
                {items.length}
              </span>
            </div>

            <div className="flex-1 p-2 space-y-2">
              {visibleItems.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-xs text-slate-400 text-center px-2">
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
                    className={`group cursor-pointer rounded-md border border-slate-200 bg-white p-3 transition-colors hover:border-blue-400 ${
                      draggedId === app.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                      {app.role_title}
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-700 truncate">
                      {app.company}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      {app.source_platform && <span>{app.source_platform}</span>}
                      {app.source_platform && app.last_update_date && (
                        <span aria-hidden="true">·</span>
                      )}
                      {app.last_update_date && (
                        <span className="font-mono-tabular">{app.last_update_date}</span>
                      )}
                      {isStaleApplication(app) && (
                        <span className="font-mono-tabular font-medium text-amber-700">
                          · {getDaysSinceUpdate(app)}d stale
                        </span>
                      )}
                    </div>

                    <div
                      className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2"
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
                        className="flex-1 min-w-0 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
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
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded border border-slate-200 shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}

              {compact && items.length > 5 && (
                <div className="text-center py-1 text-[11px] text-slate-500 font-mono-tabular">
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
