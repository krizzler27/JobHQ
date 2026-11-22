import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {createRoot} from 'react-dom/client';
import * as notification from '@tauri-apps/plugin-notification';
import App from './App.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import './index.css';

// Expose on window for direct dev testing
if (typeof window !== 'undefined') {
  (window as any).__TAURI_NOTIFICATION__ = notification;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in JobHQ UI:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backgroundColor: '#f6f5f2',
          color: '#12141d',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            background: '#ffffff',
            border: '1px solid #e5e3dc',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#58554d' }}>
              JobHQ encountered an unexpected error while rendering:
            </p>
            <pre style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              overflowX: 'auto',
              color: '#0f172a',
              margin: '0 0 20px'
            }}>
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#234aff',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <ToastProvider>
      <App />
    </ToastProvider>
  </RootErrorBoundary>,
);

