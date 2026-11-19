import {createRoot} from 'react-dom/client';
import * as notification from '@tauri-apps/plugin-notification';
import App from './App.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import './index.css';

// Expose on window for direct dev testing
if (typeof window !== 'undefined') {
  (window as any).__TAURI_NOTIFICATION__ = notification;
}

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <App />
  </ToastProvider>,
);

