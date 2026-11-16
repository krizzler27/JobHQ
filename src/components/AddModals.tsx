import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { APPLICATION_STAGES } from '../api';
import type { Application, ApplicationStatus, Interview } from '../types';

interface AddApplicationModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: Partial<Application>) => Promise<boolean | void>;
}

export const AddApplicationModal: React.FC<AddApplicationModalProps> = ({
  open,
  onClose,
  onCreate,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [company, setCompany] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('applied');
  const [sourcePlatform, setSourcePlatform] = useState('');
  const [appliedDate, setAppliedDate] = useState(today);
  const [location, setLocation] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCompany('');
      setRoleTitle('');
      setStatus('applied');
      setSourcePlatform('');
      setAppliedDate(new Date().toISOString().slice(0, 10));
      setLocation('');
      setJobUrl('');
      setNotes('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const completed = await onCreate({
        company,
        role_title: roleTitle,
        status,
        source_platform: sourcePlatform || 'Manual',
        applied_date: appliedDate,
        location,
        job_url: jobUrl.trim(),
        notes,
      });
      if (completed !== false) {
        setCompany('');
        setRoleTitle('');
        setSourcePlatform('');
        setLocation('');
        setJobUrl('');
        setNotes('');
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131926] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">Add Application</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Role Title</label>
            <input
              type="text"
              required
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Senior Backend Engineer"
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
                placeholder="Stripe"
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
                placeholder="LinkedIn"
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
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://jobs.lever.co/..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60 shadow-2xs transition-colors"
            >
              {submitting ? 'Adding...' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AddInterviewModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: Partial<Interview>) => Promise<void>;
}

export const AddInterviewModal: React.FC<AddInterviewModalProps> = ({
  open,
  onClose,
  onCreate,
}) => {
  const defaultDt = `${new Date().toISOString().slice(0, 10)}T10:00`;
  const [company, setCompany] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [roundLabel, setRoundLabel] = useState('Technical Interview');
  const [scheduledAt, setScheduledAt] = useState(defaultDt);
  const [timezone, setTimezone] = useState('PST');
  const [meetingLink, setMeetingLink] = useState('');
  const [interviewerNames, setInterviewerNames] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({
        company,
        role_title: roleTitle,
        round_label: roundLabel,
        scheduled_at: scheduledAt,
        timezone,
        meeting_link: meetingLink,
        interviewer_names: interviewerNames,
        status: 'upcoming',
      });
      setCompany('');
      setRoleTitle('');
      setMeetingLink('');
      setInterviewerNames('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131926] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">Schedule Interview</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Company</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Linear"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Round</label>
              <input
                type="text"
                value={roundLabel}
                onChange={(e) => setRoundLabel(e.target.value)}
                placeholder="Recruiter Screen"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Role Title</label>
            <input
              type="text"
              required
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Staff Frontend Engineer"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm font-mono-tabular text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="PST"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Meeting Link</label>
            <input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Interviewer(s)</label>
            <input
              type="text"
              value={interviewerNames}
              onChange={(e) => setInterviewerNames(e.target.value)}
              placeholder="Alex Rivera"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60 shadow-2xs transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Interview'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
