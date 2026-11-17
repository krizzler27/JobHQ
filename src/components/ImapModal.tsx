import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  HelpCircle,
  Mail,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { ImapPreset, ImapProvider, ImapStatus } from '../types';

const DEFAULT_PRESETS: Record<ImapProvider, ImapPreset> = {
  gmail: {
    label: 'Gmail',
    host: 'imap.gmail.com',
    port: 993,
    use_ssl: true,
    help: 'Uses a 16-letter Google App Password (not your regular Gmail password).',
  },
  outlook: {
    label: 'Outlook / Hotmail',
    host: 'outlook.office365.com',
    port: 993,
    use_ssl: true,
    help: 'Use your Microsoft email and an App Password if two-step login is on.',
  },
  yahoo: {
    label: 'Yahoo Mail',
    host: 'imap.mail.yahoo.com',
    port: 993,
    use_ssl: true,
    help: 'Uses an App Password from your Yahoo Account Security settings.',
  },
  custom: {
    label: 'Other Email',
    host: '',
    port: 993,
    use_ssl: true,
    help: 'Enter the IMAP server address and port (usually 993) from your email provider.',
  },
};

const APP_PASSWORD_STEPS: Record<ImapProvider, { title: string; steps: string[] }> = {
  gmail: {
    title: 'How to get a Gmail App Password',
    steps: [
      'Open your Google Account settings and go to Security.',
      'Turn on 2-Step Verification (Google requires this first).',
      'Search for "App passwords" at the top of the Security page.',
      'Type "JobHQ", click Create, and paste the 16-letter code below.',
    ],
  },
  outlook: {
    title: 'How to get an Outlook App Password',
    steps: [
      'Sign in at account.microsoft.com and open Security.',
      'Open Advanced security options and turn on Two-step verification.',
      'Scroll down to App passwords and select Create a new app password.',
      'Copy the generated password and paste it below.',
    ],
  },
  yahoo: {
    title: 'How to get a Yahoo App Password',
    steps: [
      'Sign in to Yahoo Mail, click your profile icon, and open Account Info.',
      'Go to Account security in the left menu.',
      'Click Generate app password (or Manage app passwords).',
      'Enter "JobHQ", click Generate, and paste the code below.',
    ],
  },
  custom: {
    title: 'How to connect another email provider',
    steps: [
      'Look up your email provider’s IMAP server address and SSL port (usually 993).',
      'Make sure IMAP access is turned on inside your webmail settings.',
      'Use your email password, or create an App Password if two-factor login is on.',
    ],
  },
};

const splitFolders = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

interface ImapFormFieldsProps {
  initialStatus?: ImapStatus | null;
  presets?: Record<ImapProvider, ImapPreset>;
  onConnected: (status: ImapStatus, mailboxMessages: number) => void;
  submitLabel?: string;
}

export const ImapConnectionForm: React.FC<ImapFormFieldsProps> = ({
  initialStatus,
  presets = DEFAULT_PRESETS,
  onConnected,
  submitLabel = 'Test & Save',
}) => {
  const [provider, setProvider] = useState<ImapProvider>(initialStatus?.provider || 'gmail');
  const [host, setHost] = useState(initialStatus?.host || 'imap.gmail.com');
  const [port, setPort] = useState(initialStatus?.port || 993);
  const [email, setEmail] = useState(initialStatus?.email || '');
  const [password, setPassword] = useState('');
  const [folderInput, setFolderInput] = useState(initialStatus?.folder || 'INBOX');
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [showPasswordGuide, setShowPasswordGuide] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(initialStatus?.provider === 'custom');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (initialStatus) {
      const nextProvider = initialStatus.provider || 'gmail';
      setProvider(nextProvider);
      setHost(initialStatus.host || presets[nextProvider].host);
      setPort(initialStatus.port || 993);
      setEmail(initialStatus.email || '');
      setFolderInput(initialStatus.folder || 'INBOX');
      if (nextProvider === 'custom') setShowAdvanced(true);
    }
  }, [initialStatus, presets]);

  const handleSelectProvider = (next: ImapProvider) => {
    setProvider(next);
    const p = presets[next];
    if (p.host) setHost(p.host);
    setPort(p.port || 993);
    setShowAdvanced(next === 'custom');
    setAvailableFolders([]);
    setError('');
    setSuccess('');
  };

  const selectedFolderList = splitFolders(folderInput);

  const toggleFolder = (name: string) => {
    const exists = selectedFolderList.some((f) => f.toLowerCase() === name.toLowerCase());
    const next = exists
      ? selectedFolderList.filter((f) => f.toLowerCase() !== name.toLowerCase())
      : [...selectedFolderList, name];
    setFolderInput(next.length > 0 ? next.join(', ') : 'INBOX');
  };

  const handleLoadFolders = async () => {
    setLoadingFolders(true);
    setError('');
    try {
      const res = await api.listImapFolders({
        provider,
        host,
        port,
        email,
        password,
        use_ssl: true,
      });
      setAvailableFolders(res.folders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load folders.');
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setError('');
    setSuccess('');
    try {
      const folders = splitFolders(folderInput);
      const res = await api.connectImap({
        provider,
        host,
        port,
        email,
        password,
        folder: folders.join(', ') || 'INBOX',
        folders: folders.length > 0 ? folders : ['INBOX'],
        use_ssl: true,
      });
      const missingNote =
        res.missing_folders && res.missing_folders.length > 0
          ? ` (Not found: ${res.missing_folders.join(', ')})`
          : '';
      setSuccess(
        `Connected to ${res.status.email} (${res.mailbox_messages} emails across ${res.status.folder})${missingNote}.`,
      );
      setPassword('');
      onConnected(res.status, res.mailbox_messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect.');
    } finally {
      setTesting(false);
    }
  };

  const activePreset = presets[provider] || DEFAULT_PRESETS.gmail;
  const guide = APP_PASSWORD_STEPS[provider] || APP_PASSWORD_STEPS.gmail;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Provider</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['gmail', 'outlook', 'yahoo', 'custom'] as const).map((key) => {
            const item = presets[key] || DEFAULT_PRESETS[key];
            const active = provider === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectProvider(key)}
                className={`px-2 sm:px-2.5 py-2 text-xs rounded-lg border text-center transition-all shadow-2xs flex items-center justify-center min-h-[38px] leading-tight cursor-pointer ${
                  active
                    ? 'bg-[#234aff]/10 dark:bg-blue-950/40 border-[#234aff] dark:border-blue-500 text-[#234aff] dark:text-blue-300 font-semibold'
                    : 'bg-white dark:bg-[#182030] border-[#e5e3dc] dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-[#f6f5f2] dark:hover:bg-slate-800 font-medium'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{activePreset.help}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Your Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            App Password {initialStatus?.has_password ? '(optional if unchanged)' : ''}
          </label>
          <input
            type="password"
            required={!initialStatus?.has_password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              initialStatus?.has_password
                ? 'Saved — leave blank to keep'
                : 'Paste 16-letter App Password'
            }
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#182030] px-3 py-2 text-sm font-mono-tabular text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Collapsible App Password Guide */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0e1420]/80 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPasswordGuide((v) => !v)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <span className="inline-flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{guide.title}</span>
          </span>
          {showPasswordGuide ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>
        {showPasswordGuide && (
          <ol className="px-4 pb-3.5 pt-1 space-y-1.5 text-xs text-slate-600 dark:text-slate-400 list-decimal list-inside border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131926]">
            {guide.steps.map((line, i) => (
              <li key={i} className="leading-relaxed">
                {line}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Folders / Labels Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="block text-xs font-medium text-slate-700">
            Folders / Labels to Check (separate multiple with commas)
          </label>
          <button
            type="button"
            onClick={handleLoadFolders}
            disabled={loadingFolders}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-60 whitespace-nowrap"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            {loadingFolders ? 'Loading...' : 'Load My Folders'}
          </button>
        </div>
        <input
          type="text"
          value={folderInput}
          onChange={(e) => setFolderInput(e.target.value)}
          placeholder="INBOX, Careers, Job Alerts"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono-tabular focus:border-blue-600 focus:outline-none"
        />
        <p className="text-[11px] text-slate-500">
          For Gmail labels or Outlook folders where you filter job emails, add them here or click Load My Folders to pick them.
        </p>

        {availableFolders.length > 0 && (
          <div className="max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {availableFolders.map((name) => {
              const checked = selectedFolderList.some(
                (f) => f.toLowerCase() === name.toLowerCase(),
              );
              return (
                <label
                  key={name}
                  className="flex items-center gap-2 px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-700 cursor-pointer hover:border-blue-400"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFolder(name)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate font-mono-tabular">{name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Collapsible Mail Server Settings */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
        >
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>Mail Server Settings</span>
        </button>

        {showAdvanced && (
          <div className="mt-2.5 grid grid-cols-3 gap-3 pt-2.5 border-t border-slate-100">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Mail Server</label>
              <input
                type="text"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="imap.gmail.com"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Port</label>
              <input
                type="number"
                required
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono-tabular focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={testing}
          className="btn-cobalt inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm disabled:opacity-60 whitespace-nowrap cursor-pointer transition-colors"
        >
          <Mail className="w-3.5 h-3.5" />
          {testing ? 'Checking connection...' : submitLabel}
        </button>
      </div>
    </form>
  );
};

interface ImapModalProps {
  open: boolean;
  status: ImapStatus | null;
  onClose: () => void;
  onConnected: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export const ImapModal: React.FC<ImapModalProps> = ({
  open,
  status,
  onClose,
  onConnected,
  onDisconnect,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl border border-[#e5e3dc] dark:border-slate-800/90 bg-white dark:bg-[#131926] my-8 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e3dc] dark:border-slate-800/80 bg-[#faf9f6] dark:bg-[#182030]/60">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">Connect Email</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Your credentials stay on your device and are used only to scan job emails.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <ImapConnectionForm
            initialStatus={status}
            onConnected={async () => {
              await onConnected();
              onClose();
            }}
          />

          {status?.connected && status.source === 'saved' && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400 dark:text-slate-500">Connected: {status.email}</span>
              <button
                type="button"
                onClick={async () => {
                  await onDisconnect();
                  onClose();
                }}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Disconnect Email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
