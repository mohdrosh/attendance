import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface ToastState {
  message: string | null;
  showToast: (msg: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ message, showToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
