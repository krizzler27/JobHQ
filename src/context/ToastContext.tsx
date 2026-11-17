import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ToastContainer } from '../components/Toast';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastOptions {
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (type: ToastType, title: string, options?: ToastOptions) => string;
  removeToast: (id: string) => void;
  toast: {
    success: (title: string, messageOrOptions?: string | ToastOptions) => string;
    error: (title: string, messageOrOptions?: string | ToastOptions) => string;
    info: (title: string, messageOrOptions?: string | ToastOptions) => string;
    warning: (title: string, messageOrOptions?: string | ToastOptions) => string;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCount = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, title: string, options?: ToastOptions): string => {
    const id = `toast-${++toastCount}-${Date.now()}`;
    const newToast: ToastItem = {
      id,
      type,
      title,
      message: options?.message,
      duration: options?.duration ?? 4000,
      action: options?.action,
    };

    setToasts((prev) => {
      // Keep up to 4 most recent toasts
      const trimmed = prev.length >= 4 ? prev.slice(prev.length - 3) : prev;
      return [...trimmed, newToast];
    });

    return id;
  }, []);

  const toast = useMemo(() => {
    const normalize = (
      type: ToastType,
      title: string,
      messageOrOptions?: string | ToastOptions,
    ) => {
      if (typeof messageOrOptions === 'string') {
        return addToast(type, title, { message: messageOrOptions });
      }
      return addToast(type, title, messageOrOptions);
    };

    return {
      success: (title: string, opts?: string | ToastOptions) => normalize('success', title, opts),
      error: (title: string, opts?: string | ToastOptions) => normalize('error', title, opts),
      info: (title: string, opts?: string | ToastOptions) => normalize('info', title, opts),
      warning: (title: string, opts?: string | ToastOptions) => normalize('warning', title, opts),
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
