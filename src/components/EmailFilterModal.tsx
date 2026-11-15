import React, { useEffect, useState } from 'react';
import { Check, Plus, ShieldBan, X } from 'lucide-react';
import { api } from '../api';
import type { EmailFilterContext, ProfileSettings } from '../types';

export interface EmailFilterTarget {
  kind: 'application' | 'interview' | 'alert';
  id: number;
  label?: string;
}

interface EmailFilterModalProps {
  target: EmailFilterTarget | null;
  profile: ProfileSettings | null;
  onClose: () => void;
  onApplied: (info: {
    addedNoise: string[];
    removedAllowed: string[];
    deletedItem: boolean;
  }) => Promise<void>;
}

const KIND_LABEL: Record<EmailFilterTarget['kind'], string> = {
  application: 'application',
  interview: 'interview',
  alert: 'job alert',
};

export const EmailFilterModal: React.FC<EmailFilterModalProps> = ({
  target,
  profile,
  onClose,
  onApplied,
}) => {
  const [ctx, setCtx] = useState<EmailFilterContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedNoise, setSelectedNoise] = useState<string[]>([]);
  const [customNoiseDraft, setCustomNoiseDraft] = useState('');
  const [removeSubjectKws, setRemoveSubjectKws] = useState<string[]>([]);
  const [removeSenderKws, setRemoveSenderKws] = useState<string[]>([]);
  const [alsoDelete, setAlsoDelete] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) {
      setCtx(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setSelectedNoise([]);
    setCustomNoiseDraft('');
    setRemoveSubjectKws([]);
    setRemoveSenderKws([]);
    setAlsoDelete(true);

    api
      .getEmailFilterContext(target.kind, target.id)
      .then((res) => {
        if (cancelled) return;
        setCtx(res);
        // Pre-select specific sender email or domain when available
        const defaults: string[] = [];
        if (res.sender_email && res.suggested_noise_terms.includes(res.sender_email)) {
          defaults.push(res.sender_email);
        } else if (res.suggested_noise_terms.length > 0) {
          defaults.push(res.suggested_noise_terms[0]);
        }
        setSelectedNoise(defaults);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not inspect email source.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!target) return null;

  const toggleNoiseTerm = (term: string) => {
    const low = term.toLowerCase();
    setSelectedNoise((prev) =>
      prev.some((x) => x.toLowerCase() === low)
        ? prev.filter((x) => x.toLowerCase() !== low)
        : [...prev, term],
    );
  };

  const addCustomNoise = () => {
    const incoming = customNoiseDraft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (incoming.length === 0) return;
    setSelectedNoise((prev) => {
      const seen = new Set(prev.map((x) => x.toLowerCase()));
      const next = [...prev];
      for (const term of incoming) {
        if (!seen.has(term.toLowerCase())) {
          seen.add(term.toLowerCase());
          next.push(term);
        }
      }
      return next;
    });
    setCustomNoiseDraft('');
  };

  const toggleRemoveSubject = (kw: string) => {
    const low = kw.toLowerCase();
    setRemoveSubjectKws((prev) =>
      prev.some((x) => x.toLowerCase() === low)
        ? prev.filter((x) => x.toLowerCase() !== low)
        : [...prev, kw],
    );
  };

  const toggleRemoveSender = (kw: string) => {
    const low = kw.toLowerCase();
    setRemoveSenderKws((prev) =>
      prev.some((x) => x.toLowerCase() === low)
        ? prev.filter((x) => x.toLowerCase() !== low)
        : [...prev, kw],
    );
  };

  const hasFilterChanges =
    selectedNoise.length > 0 || removeSubjectKws.length > 0 || removeSenderKws.length > 0;

  const handleSave = async () => {
    if (!hasFilterChanges && !alsoDelete) {
      onClose();
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (hasFilterChanges) {
        const currentProfile = profile || (await api.getProfile());
        const existingNoise = currentProfile.scan_exclude_keywords || [];
        const noiseSeen = new Set(existingNoise.map((x) => x.toLowerCase()));
        const nextNoise = [...existingNoise];
        const actuallyAdded: string[] = [];
        for (const term of selectedNoise) {
          const clean = term.trim();
          if (clean && !noiseSeen.has(clean.toLowerCase())) {
            noiseSeen.add(clean.toLowerCase());
            nextNoise.push(clean);
            actuallyAdded.push(clean);
          }
        }

        const removeSubSet = new Set(removeSubjectKws.map((x) => x.toLowerCase()));
        const removeSenSet = new Set(removeSenderKws.map((x) => x.toLowerCase()));
        const nextSubject = (currentProfile.scan_subject_keywords || []).filter(
          (k) => !removeSubSet.has(k.toLowerCase()),
        );
        const nextSender = (currentProfile.scan_sender_keywords || []).filter(
          (k) => !removeSenSet.has(k.toLowerCase()),
        );

        await api.updateProfile({
          scan_exclude_keywords: nextNoise,
          scan_subject_keywords: nextSubject,
          scan_sender_keywords: nextSender,
        });

        if (alsoDelete) {
          if (target.kind === 'application') await api.deleteApplication(target.id);
          else if (target.kind === 'interview') await api.deleteInterview(target.id);
          else await api.deleteAlert(target.id);
        }

        await onApplied({
          addedNoise: actuallyAdded,
          removedAllowed: [...removeSubjectKws, ...removeSenderKws],
          deletedItem: alsoDelete,
        });
      } else if (alsoDelete) {
        if (target.kind === 'application') await api.deleteApplication(target.id);
        else if (target.kind === 'interview') await api.deleteInterview(target.id);
        else await api.deleteAlert(target.id);

        await onApplied({
          addedNoise: [],
          removedAllowed: [],
          deletedItem: true,
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update email filters.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white overflow-hidden my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShieldBan className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Filter Non-Career Email
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Block this sender/topic from future IMAP scans or trim broad allowed keywords.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="space-y-3 py-4">
              <div className="h-14 rounded-md bg-slate-100 animate-pulse" />
              <div className="h-24 rounded-md bg-slate-100 animate-pulse" />
            </div>
          ) : (
            <>
              {/* Source Email Metadata */}
              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5 text-xs">
                <div className="font-semibold text-slate-900">
                  {ctx?.title || target.label || `Selected ${KIND_LABEL[target.kind]}`}
                </div>
                {ctx?.subtitle && <div className="text-slate-600">{ctx.subtitle}</div>}
                {ctx?.sender ? (
                  <div className="pt-1 text-[11px] text-slate-600 font-mono-tabular break-all">
                    <span className="font-semibold text-slate-700 font-sans">Sender:</span>{' '}
                    {ctx.sender}
                  </div>
                ) : (
                  <div className="pt-1 text-[11px] text-slate-500">
                    No raw sender address stored for this item — add any keyword or domain below.
                  </div>
                )}
                {ctx?.subject && (
                  <div className="text-[11px] text-slate-600 break-words">
                    <span className="font-semibold text-slate-700">Subject:</span> {ctx.subject}
                  </div>
                )}
              </div>

              {/* Add to Skip / Noise Words */}
              <div className="space-y-2.5">
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Add to Skip / Noise Words (Always Ignore)
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Pick suggested terms from this email or type your own sender, domain, or phrase.
                  </p>
                </div>

                {ctx && ctx.suggested_noise_terms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {ctx.suggested_noise_terms.map((term) => {
                      const active = selectedNoise.some(
                        (x) => x.toLowerCase() === term.toLowerCase(),
                      );
                      return (
                        <button
                          key={term}
                          type="button"
                          onClick={() => toggleNoiseTerm(term)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border transition-colors ${
                            active
                              ? 'bg-rose-50 border-rose-300 text-rose-800 font-medium'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {active && <Check className="w-3 h-3 shrink-0" />}
                          <span>{term}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customNoiseDraft}
                    onChange={(e) => setCustomNoiseDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomNoise();
                      }
                    }}
                    placeholder="Add custom sender, domain, or keyword (comma-separated)..."
                    className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addCustomNoise}
                    disabled={!customNoiseDraft.trim()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>

                {selectedNoise.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] font-medium text-slate-500">Will add:</span>
                    {selectedNoise.map((term) => (
                      <span
                        key={term}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border bg-rose-50 text-rose-800 border-rose-200"
                      >
                        <span>{term}</span>
                        <button
                          type="button"
                          onClick={() => toggleNoiseTerm(term)}
                          aria-label={`Remove ${term}`}
                          className="text-rose-500 hover:text-rose-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Matched Allowed List Keywords */}
              {ctx &&
                (ctx.matched_subject_keywords.length > 0 ||
                  ctx.matched_sender_keywords.length > 0) && (
                  <div className="rounded-md border border-slate-200 bg-slate-50/50 p-3.5 space-y-2.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Matched Allowed Scan Keywords
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Check any overly broad keyword below to remove it from your allowed scan list.
                      </p>
                    </div>

                    {ctx.matched_subject_keywords.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-slate-600">
                          Subject keywords matched:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ctx.matched_subject_keywords.map((kw) => {
                            const checked = removeSubjectKws.some(
                              (x) => x.toLowerCase() === kw.toLowerCase(),
                            );
                            return (
                              <label
                                key={kw}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-700 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleRemoveSubject(kw)}
                                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                />
                                <span>Remove &ldquo;{kw}&rdquo;</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {ctx.matched_sender_keywords.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-slate-600">
                          Sender keywords matched:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ctx.matched_sender_keywords.map((kw) => {
                            const checked = removeSenderKws.some(
                              (x) => x.toLowerCase() === kw.toLowerCase(),
                            );
                            return (
                              <label
                                key={kw}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-700 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleRemoveSender(kw)}
                                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                />
                                <span>Remove &ldquo;{kw}&rdquo;</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* Offer to delete item */}
              <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoDelete}
                  onChange={(e) => setAlsoDelete(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>
                  Also delete this {KIND_LABEL[target.kind]} from my workspace
                </span>
              </label>

              {error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || (!hasFilterChanges && !alsoDelete)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                >
                  <ShieldBan className="w-3.5 h-3.5" />
                  {saving
                    ? 'Saving...'
                    : hasFilterChanges && alsoDelete
                    ? 'Save Filter & Delete Item'
                    : hasFilterChanges
                    ? 'Save Filter Rule'
                    : 'Delete Item'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
