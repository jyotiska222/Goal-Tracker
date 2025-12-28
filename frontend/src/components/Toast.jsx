import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const Toast = ({ toast, onClose }) => {
  const isLoading = toast.type === 'loading';
  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, toast.duration || 2200);

      const removeTimer = setTimeout(() => {
        onClose();
      }, (toast.duration || 2200) + 400);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(removeTimer);
      };
    }
  }, [toast.duration, isLoading, onClose]);

  return (
    <div
      className={`
        fixed top-6 left-1/2 z-[9999]
        w-[360px] max-w-[calc(100%-2rem)]
        -translate-x-1/2
        transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
        ${isExiting
          ? 'opacity-0 -translate-y-4 scale-95'
          : 'opacity-100 translate-y-0 scale-100'}
      `}
    >
      <div
        className="
          relative overflow-hidden rounded-2xl
          backdrop-blur-xl bg-white/10
          border border-white/20
          shadow-[0_20px_40px_rgba(0,0,0,0.25)]
        "
      >
        {/* Liquid glass shine */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

        <div className="relative p-4">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="shrink-0">
              {isLoading && (
                <div className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
              )}

              {isSuccess && (
                <CheckCircle2 className="w-5 h-5 text-green-300" />
              )}

              {isError && (
                <AlertCircle className="w-5 h-5 text-red-300" />
              )}
            </div>

            {/* Message */}
            <div className="flex-1 text-sm font-medium text-white/90">
              {toast.message}
            </div>

            {!isLoading && (
              <button
                onClick={onClose}
                className="text-white/50 hover:text-white transition"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;
