import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

const ImmersiveToast = ({ 
  id, 
  message, 
  type = 'loading', 
  duration = 5000, 
  onDismiss,
  progress = 0 
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    setDisplayProgress(progress);
  }, [progress]);

  useEffect(() => {
    if (type === 'success' || type === 'error') {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onDismiss(id), 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [type, duration, id, onDismiss]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'loading':
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      default:
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-gradient-to-r from-green-900/80 to-green-800/60';
      case 'error':
        return 'bg-gradient-to-r from-red-900/80 to-red-800/60';
      case 'loading':
        return 'bg-gradient-to-r from-blue-900/80 to-blue-800/60';
      default:
        return 'bg-gradient-to-r from-gray-800/80 to-gray-700/60';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-green-500/30';
      case 'error':
        return 'border-red-500/30';
      case 'loading':
        return 'border-blue-500/30';
      default:
        return 'border-gray-500/30';
    }
  };

  const getProgressColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'loading':
        return 'bg-gradient-to-r from-blue-400 to-blue-600';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div
      className={`
        fixed bottom-6 right-6 max-w-sm transition-all duration-300 ease-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
    >
      <div
        className={`
          ${getBackgroundColor()} 
          border ${getBorderColor()}
          rounded-2xl backdrop-blur-xl p-4 shadow-2xl
          flex items-start gap-4
        `}
      >
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm leading-snug">
            {message}
          </p>

          {/* Progress Bar */}
          {(type === 'loading' || (type === 'success' && displayProgress > 0)) && (
            <div className="mt-3 w-full h-1.5 bg-gray-700/40 rounded-full overflow-hidden">
              <div
                className={`
                  h-full ${getProgressColor()} 
                  rounded-full transition-all duration-300 ease-out
                `}
                style={{ width: `${displayProgress}%` }}
              />
            </div>
          )}

          {type === 'loading' && (
            <p className="text-xs text-gray-300 mt-2">
              Processing... {Math.round(displayProgress)}%
            </p>
          )}
        </div>

        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => onDismiss(id), 300);
          }}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors mt-0.5"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ImmersiveToast;
