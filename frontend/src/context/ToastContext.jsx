import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const updateToast = useCallback((id, updates) => {
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, ...updates } : toast
      )
    );
  }, []);

  const showToast = useCallback((message, options = {}) => {
    const {
      type = 'loading', // 'loading', 'success', 'error'
      duration = 5000,
      onClose = null,
    } = options;

    const id = Date.now();
    const toast = {
      id,
      message,
      type,
      duration,
      onClose,
    };

    setToasts((prev) => [...prev, toast]);

    if (type !== 'loading') {
      const timer = setTimeout(() => {
        removeToast(id);
        if (onClose) onClose();
      }, duration);

      return { id, timer };
    }

    return { id };
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast, updateToast, toasts }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
