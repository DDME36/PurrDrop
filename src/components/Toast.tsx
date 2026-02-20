'use client';

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';

// Lucide Icons
const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
);

const XCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="m15 9-6 6"/>
    <path d="m9 9 6 6"/>
  </svg>
);

const AlertTriangleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4"/>
    <path d="M12 8h.01"/>
  </svg>
);

export interface ToastRef {
  show: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export const Toast = forwardRef<ToastRef>(function Toast(_, ref) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  useImperativeHandle(ref, () => ({ show }));

  const icons = {
    success: <CheckCircleIcon />,
    error: <XCircleIcon />,
    warning: <AlertTriangleIcon />,
    info: <InfoIcon />,
  };

  return (
    <div id="toastContainer">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span className="toast-icon">{icons[toast.type]}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
});
