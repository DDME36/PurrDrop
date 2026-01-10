'use client';

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';

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
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div id="toastContainer">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span>{icons[toast.type]}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
});
