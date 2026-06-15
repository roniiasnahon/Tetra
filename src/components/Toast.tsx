import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MaterialIcon } from './MaterialIcon';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// Global helper to show toasts easily from anywhere
export const showToast = (message: string, type: ToastType = 'success', duration = 3000, id?: string) => {
  const event = new CustomEvent('app-toast', {
    detail: { message, type, duration, id }
  });
  window.dispatchEvent(event);
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    // Keep track of active timeouts by toast ID to avoid overlapping timeouts
    const timeoutsMap: { [id: string]: NodeJS.Timeout } = {};

    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type: ToastType; duration?: number; id?: string }>;
      if (!customEvent.detail) return;

      const { message, type, duration = 3000, id } = customEvent.detail;
      const toastId = id || Math.random().toString(36).substr(2, 9);
      
      setToasts((prev) => {
        const index = prev.findIndex((t) => t.id === toastId);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            message,
            type,
            duration
          };
          return updated;
        } else {
          const newToast: ToastMessage = {
            id: toastId,
            message,
            type,
            duration
          };
          return [...prev, newToast];
        }
      });

      // Clear existing timeout for this toast ID if any
      if (timeoutsMap[toastId]) {
        clearTimeout(timeoutsMap[toastId]);
        delete timeoutsMap[toastId];
      }

      if (duration > 0) {
        timeoutsMap[toastId] = setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId));
          delete timeoutsMap[toastId];
        }, duration);
      }
    };

    window.addEventListener('app-toast', handleToastEvent);
    return () => {
      window.removeEventListener('app-toast', handleToastEvent);
      // Clean up all active timeouts
      Object.values(timeoutsMap).forEach(clearTimeout);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <MaterialIcon name="check_circle" fill={true} className="text-emerald-400 text-[18px] shrink-0" />;
      case 'error':
        return <MaterialIcon name="error" fill={true} className="text-rose-400 text-[18px] shrink-0" />;
      case 'warning':
        return <MaterialIcon name="warning" fill={true} className="text-amber-400 text-[18px] shrink-0" />;
      case 'loading':
        return <MaterialIcon name="progress_activity" className="text-emerald-400 text-[18px] animate-spin shrink-0" />;
      case 'info':
      default:
        return <MaterialIcon name="info" fill={true} className="text-blue-400 text-[18px] shrink-0" />;
    }
  };

  return (
    <div 
      id="toast-container"
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15 } }}
            className="flex items-center gap-3 p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl pointer-events-auto select-none"
          >
            <div className="shrink-0 flex items-center justify-center">
              {getIcon(toast.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium font-sans text-zinc-100 leading-normal word-break break-words">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg bg-transparent border-0 cursor-pointer flex items-center justify-center"
            >
              <MaterialIcon name="close" className="text-[16px]" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
