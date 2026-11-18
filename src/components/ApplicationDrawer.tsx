import React, { useEffect, useState } from 'react';
import { ExternalLink, ShieldBan, Trash2, X } from 'lucide-react';
import { APPLICATION_STAGES } from '../api';
import type { Application, ApplicationStatus } from '../types';

interface ApplicationDrawerProps {
  application: Application | null;
  onClose: () => void;
  onSave: (id: number, updates: Partial<Application>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onFilterEmail: (app: Application) => void;
}

export const ApplicationDrawer: React.FC<ApplicationDrawerProps> = ({
  application,
  onClose,
  onSave,
  onDelete,
  onFilterEmail,
}) => {
  const [company, setCompany] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('applied');
  const [sourcePlatform, setSourcePlatform] = useState('');
  const [appliedDate, setAppliedDate] = useState('');
  const [location, setLocation] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (application) {
      setCompany(application.company);
      setRoleTitle(application.role_title);
      setStatus(application.status);
      setSourcePlatform(application.source_platform);
      setAppliedDate(application.applied_date);
      setLocation(application.location);
      setJobUrl(application.job_url || '');
      setRejectionReason(application.rejection_reason || '');
      setRejectionNotes(application.rejection_notes || '');
      setNotes(application.notes);
      setConfirmDelete(false);
    }
  }, [application]);

  if (!application) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(application.id, {
        company,
        role_title: roleTitle,
        status,
        source_platform: sourcePlatform,
        applied_date: appliedDate,
        location,
        job_url: jobUrl.trim(),
        rejection_reason: rejectionReason.trim(),
        rejection_notes: rejectionNotes.trim(),
        notes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-[#131926] h-full border-l border-[#e5e3dc] dark:border-slate-800/90 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e3dc] dark:border-slate-800/80">
          <div>
            <h2 className="text-base font-bold tracking-tight text-[#12141d] dark:text-slate-100 font-display">Application Details</h2>
            <p className="text-xs text-[#8e8a7f] dark:text-slate-500 mt-0.5 font-mono-tabular">
              Updated {application.last_update_date || application.updated_at.slice(0, 10)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Role Title</label>
            <input
              type="text"
              required
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Company</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Stage</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
              >
                {APPLICATION_STAGES.map((st) => (
                  <option key={st.key} value={st.key}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Source App</label>
              <input
                type="text"
                value={sourcePlatform}
                onChange={(e) => setSourcePlatform(e.target.value)}
                placeholder="LinkedIn, Direct"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Applied Date</label>
              <input
                type="date"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm font-mono-tabular text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Remote"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Job / Portal Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://boards.greenhouse.io/..."
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
              />
              {jobUrl.trim().startsWith('http') && (
                <a
                  href={jobUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg hover:bg-blue-100 shrink-0"
                >
                  Open
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Recruiter contact, compensation range, follow-up reminders..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
            />
          </div>

          {(status === 'rejected' || status === 'ghosted') && (
            <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                  {status === 'rejected' ? 'Rejection Post-Mortem' : 'Ghosting Retro Notes'}
                </span>
                <span className="text-[10px] text-rose-500/80 uppercase font-semibold tracking-wider">
                  Outcome Tag
                </span>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Reason / Pattern
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded-lg border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#182030] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:outline-none shadow-2xs"
                >
                  <option value="">No reason specified</option>
                  <option value="Ghosted after applied">Ghosted after applied (no reply)</option>
                  <option value="Ghosted after interview">Ghosted after interview</option>
                  <option value="Passed on tech round">Passed on tech round / assessment</option>
                  <option value="Passed on behavioral/culture">Passed on behavioral / culture</option>
                  <option value="Role cancelled / frozen">Role cancelled / headcount frozen</option>
                  <option value="Salary mismatch">Compensation / salary mismatch</option>
                  <option value="Experience gap">Experience level / seniority gap</option>
                  <option value="Location / sponsorship">Location or visa / sponsorship</option>
                  <option value="Standard automated template">Generic automated rejection email</option>
                  <option value="Other">Other / custom feedback</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Learnings & Retro Notes
                </label>
                <textarea
                  rows={2}
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  placeholder="What went wrong? Feedback from interviewer? Areas to practice..."
                  className="w-full rounded-lg border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#182030] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:outline-none shadow-2xs"
                />
              </div>
            </div>
          )}

          {(application.latest_email_subject || application.latest_email_snippet) && (
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0e1420]/80 p-3.5 space-y-1.5 shadow-2xs">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Latest Parsed Email
              </div>
              {application.latest_email_subject && (
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {application.latest_email_subject}
                </div>
              )}
              {application.latest_email_snippet && (
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {application.latest_email_snippet}
                </p>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
            {!confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => onFilterEmail(application)}
                  title="Block sender or domain from future email scans"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                >
                  <ShieldBan className="w-3.5 h-3.5 text-slate-400" />
                  Filter Email
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await onDelete(application.id);
                    onClose();
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg whitespace-nowrap shrink-0 shadow-2xs transition-colors"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-cobalt px-4 py-2 text-xs font-bold rounded-xl disabled:opacity-60 whitespace-nowrap shrink-0 shadow-2xs transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
