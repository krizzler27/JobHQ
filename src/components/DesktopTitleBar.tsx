import React, { useEffect, useState } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

export const DesktopTitleBar: React.FC = () => {
  const [isTauri, setIsTauri] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Detect if running inside Tauri webview
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      setIsTauri(true);

      // Listen for window resize/maximize state
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const appWindow = getCurrentWindow();
        appWindow.isMaximized().then(setIsMaximized);
      }).catch(() => {
        // Fallback if API not available
      });
    }
  }, []);

  if (!isTauri) return null;

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.toggleMaximize();
      setIsMaximized(await win.isMaximized());
    } catch (e) {
      console.error(e);
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      // Hide window to system tray instead of destroying process
      await getCurrentWindow().hide();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="h-9 w-full bg-[var(--canvas)] border-b border-[#e5e3dc] dark:border-slate-800 flex items-center justify-between select-none z-50 shrink-0 px-3"
    >
      {/* Brand icon + Title */}
      <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
        <img src="/img/Logo Icon Light No BG.png" alt="JobHQ" className="w-4 h-4 object-contain" />
        <span className="text-xs font-bold tracking-tight text-[#12141d] dark:text-slate-200 font-display">
          JobHQ
        </span>
      </div>

      {/* Drag region filler */}
      <div data-tauri-drag-region className="flex-1 h-full" />

      {/* Window Controls */}
      <div className="flex items-center gap-1 -mr-1">
        <button
          type="button"
          onClick={handleMinimize}
          className="relative z-50 h-7 w-8 inline-flex items-center justify-center rounded text-stone-500 hover:text-stone-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-stone-200/60 dark:hover:bg-slate-800 transition-colors pointer-events-auto cursor-pointer"
          title="Minimize"
          aria-label="Minimize"
        >
          <Minus className="w-3.5 h-3.5 pointer-events-none" />
        </button>
        <button
          type="button"
          onClick={handleToggleMaximize}
          className="relative z-50 h-7 w-8 inline-flex items-center justify-center rounded text-stone-500 hover:text-stone-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-stone-200/60 dark:hover:bg-slate-800 transition-colors pointer-events-auto cursor-pointer"
          title={isMaximized ? "Restore" : "Maximize"}
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Copy className="w-3 h-3 pointer-events-none" /> : <Square className="w-3 h-3 pointer-events-none" />}
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="relative z-50 h-7 w-8 inline-flex items-center justify-center rounded text-stone-500 hover:text-white hover:bg-rose-600 transition-colors pointer-events-auto cursor-pointer"
          title="Close"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5 pointer-events-none" />
        </button>
      </div>
    </div>
  );
};
