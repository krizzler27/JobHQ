import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { APPLICATION_STAGES } from '../api';
import type { AlertConvertPayload } from '../api';
import type { ApplicationStatus, JobAlert } from '../types';

interface MoveAlertModalProps {
  alert: JobAlert | null;
  initialTarget: 'application' | 'interview';
  onClose: () => void;
  onConfirm: (alertId: number, payload: AlertConvertPayload) => Promise<boolean | void>;
}

export const MoveAlertModal: React.FC<MoveAlertModalProps> = ({
  alert,
  initialTarget,
  onClose,
  onConfirm,
}) => {
  const [target, setTarget] = useState<'application' | 'interview'>(initialTarget);
  const [company, setCompany] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('applied');
  const [appliedDate, setAppliedDate] = useState('');
  const [roundLabel, setRoundLabel] = useState('Interview');
  const [scheduledAt, setScheduledAt] = useState('');
  const [timezone, setTimezone] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [interviewerNames, setInterviewerNames] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!alert) return;
    setTarget(initialTarget);
    setCompany(alert.company_name || '');
    setRoleTitle(alert.job_title || '');
    setStatus('applied');
    setAppliedDate((alert.received_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10));
    setRoundLabel('Interview');
    const baseDate = (alert.received_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    setScheduledAt(`${baseDate}T10:00`);
    setTimezone('');
    setMeetingLink('');
    setInterviewerNames('');
    setJobUrl(alert.job_url || '');
  }, [alert, initialTarget]);

  if (!alert) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const completed = await onConfirm(alert.id, {
        target,
        company: company.trim(),
        role_title: roleTitle.trim(),
        source_platform: alert.source_app,
        job_url: jobUrl.trim(),
        ...(target === 'application'
          ? {
              status,
              applied_date: appliedDate,
            }
          : {
              round_label: roundLabel.trim() || 'Interview',
              scheduled_at: scheduledAt,
              timezone: timezone.trim(),
              meeting_link: meetingLink.trim(),
              interviewer_names: interviewerNames.trim(),
            }),
      });
      if (completed !== false) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Move Misclassified Alert
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Move this item out of Job Alerts and track it properly.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {alert.email_subject && (
            <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
              <span className="font-medium text-slate-700">Email subject:</span>{' '}
              <span className="break-words">{alert.email_subject}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
            <button
              type="button"
              onClick={() => setTarget('application')}
              className={`py-1.5 text-xs font-medium rounded transition-colors ${
                target === 'application'
                  ? 'bg-white text-slate-900 border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Application
            </button>
            <button
              type="button"
              onClick={() => setTarget('interview')}
              className={`py-1.5 text-xs font-medium rounded transition-colors ${
                target === 'interview'
                  ? 'bg-white text-slate-900 border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Upcoming Interview
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Hitachi Solutions DAC"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role Title</label>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="Senior Software Engineer"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {target === 'application' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Stage</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-600 focus:outline-none"
                >
                  {APPLICATION_STAGES.map((st) => (
                    <option key={st.key} value={st.key}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Applied Date
                </label>
                <input
                  type="date"
                  value={appliedDate}
                  onChange={(e) => setAppliedDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Round</label>
                  <input
                    type="text"
                    value={roundLabel}
                    onChange={(e) => setRoundLabel(e.target.value)}
                    placeholder="Technical Interview"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Timezone
                  </label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="PST / EST / IST"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Meeting Link
                  </label>
                  <input
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Interviewers
                  </label>
                  <input
                    type="text"
                    value={interviewerNames}
                    onChange={(e) => setInterviewerNames(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Job / Portal Link
            </label>
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-60"
            >
              {submitting
                ? 'Moving...'
                : target === 'interview'
                ? 'Move to Upcoming Interview'
                : 'Move to Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
