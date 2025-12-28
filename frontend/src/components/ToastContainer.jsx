import React from 'react';
import Toast from './Toast';
import { useToast } from '../context/ToastContext';

const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-0 left-0 right-0 pointer-events-none z-[9999]">
      <div className="flex flex-col items-center gap-3 p-4">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onClose={() => removeToast(toast.id)} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ToastContainer;
