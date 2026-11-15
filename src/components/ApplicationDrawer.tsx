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
        notes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/25">
      <div className="w-full max-w-lg bg-white h-full border-l border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Application Details</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono-tabular">
              Updated {application.last_update_date || application.updated_at.slice(0, 10)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
            aria-label="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Role Title</label>
            <input
              type="text"
              required
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Stage</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:border-blue-600 focus:outline-none"
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
              <label className="block text-xs font-medium text-slate-700 mb-1">Source App</label>
              <input
                type="text"
                value={sourcePlatform}
                onChange={(e) => setSourcePlatform(e.target.value)}
                placeholder="LinkedIn, Direct"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Applied Date</label>
              <input
                type="date"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono-tabular text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Remote"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Job / Portal Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://boards.greenhouse.io/..."
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              {jobUrl.trim().startsWith('http') && (
                <a
                  href={jobUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md whitespace-nowrap shrink-0"
                >
                  Open
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Recruiter contact, compensation range, follow-up reminders..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {(application.latest_email_subject || application.latest_email_snippet) && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
              <div className="text-xs font-semibold text-slate-700">
                Latest Parsed Email
              </div>
              {application.latest_email_subject && (
                <div className="text-xs font-medium text-slate-900">
                  {application.latest_email_subject}
                </div>
              )}
              {application.latest_email_snippet && (
                <p className="text-xs text-slate-600 leading-relaxed">
                  {application.latest_email_snippet}
                </p>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            {!confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => onFilterEmail(application)}
                  title="Block sender or domain from future email scans"
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-md whitespace-nowrap shrink-0"
                >
                  <ShieldBan className="w-3.5 h-3.5 text-slate-500" />
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
                  className="px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md whitespace-nowrap shrink-0"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-60 whitespace-nowrap shrink-0"
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
