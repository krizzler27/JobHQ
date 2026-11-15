import React, { useState } from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import type { DuplicateMatch } from '../types';

export interface DuplicateGuardCandidate {
  company: string;
  role_title: string;
  source_platform?: string;
  job_url?: string;
}

interface DuplicateGuardModalProps {
  open: boolean;
  candidate: DuplicateGuardCandidate | null;
  matches: DuplicateMatch[];
  onCancel: () => void;
  onUpdateExisting: (existingId: number) => Promise<void>;
  onAddAnyway: () => Promise<void>;
}

export const DuplicateGuardModal: React.FC<DuplicateGuardModalProps> = ({
  open,
  candidate,
  matches,
  onCancel,
  onUpdateExisting,
  onAddAnyway,
}) => {
  const [busyAction, setBusyAction] = useState<'update' | 'add' | null>(null);

  if (!open || !candidate || matches.length === 0) return null;

  const primary = matches[0];

  const handleUpdate = async () => {
    setBusyAction('update');
    try {
      await onUpdateExisting(primary.id);
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddAnyway = async () => {
    setBusyAction('add');
    try {
      await onAddAnyway();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Possible Duplicate Application
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                A matching entry already exists ({primary.match_reason.toLowerCase()}).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busyAction !== null}
            className="p-1 text-slate-400 hover:text-slate-700 rounded"
            aria-label="Close duplicate guard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-amber-800">
              <span>EXISTING RECORD</span>
              <span className="font-mono-tabular uppercase">{primary.status}</span>
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {primary.role_title}
            </div>
            <div className="text-xs text-slate-700 flex flex-wrap items-center gap-1.5">
              <span className="font-medium">{primary.company}</span>
              {primary.source_platform && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{primary.source_platform}</span>
                </>
              )}
              {primary.applied_date && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">Applied {primary.applied_date}</span>
                </>
              )}
              {primary.last_update_date && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">Updated {primary.last_update_date}</span>
                </>
              )}
            </div>
            {primary.job_url && (
              <div className="pt-1">
                <a
                  href={primary.job_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                >
                  Open Existing Job Link
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {matches.length > 1 && (
            <p className="text-[11px] text-slate-500">
              +{matches.length - 1} more matching application record
              {matches.length - 1 === 1 ? '' : 's'} found.
            </p>
          )}

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 space-y-1">
            <div>
              <span className="font-medium text-slate-800">Update Existing:</span> refreshes the last update date, fills any missing job link or source platform, and appends notes to the existing card.
            </div>
            <div>
              <span className="font-medium text-slate-800">Add Anyway:</span> saves <span className="font-medium text-slate-800">{candidate.role_title}</span> at <span className="font-medium text-slate-800">{candidate.company}</span> as a separate application.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={busyAction !== null}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddAnyway}
              disabled={busyAction !== null}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-60"
            >
              {busyAction === 'add' ? 'Adding...' : 'Add Anyway'}
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={busyAction !== null}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-60"
            >
              {busyAction === 'update' ? 'Updating...' : 'Update Existing'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
