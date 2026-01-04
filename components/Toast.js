import { useEffect, useState } from 'react';

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  const [isLeaving, setIsLeaving] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration > 0) {
      // Progress bar animation
      const startTime = Date.now();
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setProgress(remaining);
      }, 50);

      // Auto-close timer
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => {
        clearTimeout(timer);
        clearInterval(progressInterval);
      };
    }
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  const colors = {
    success: {
      bg: 'bg-gradient-to-r from-green-500/20 to-emerald-500/20',
      border: 'border-green-500/50',
      text: 'text-green-400',
      progress: 'bg-green-500',
    },
    error: {
      bg: 'bg-gradient-to-r from-red-500/20 to-rose-500/20',
      border: 'border-red-500/50',
      text: 'text-red-400',
      progress: 'bg-red-500',
    },
    info: {
      bg: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500/50',
      text: 'text-blue-400',
      progress: 'bg-blue-500',
    },
    warning: {
      bg: 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20',
      border: 'border-yellow-500/50',
      text: 'text-yellow-400',
      progress: 'bg-yellow-500',
    },
  };

  const style = colors[type] || colors.info;

  return (
    <div
      className={`fixed top-4 right-4 z-50 min-w-[300px] max-w-md rounded-xl border backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-200 ${style.bg} ${style.border} ${style.text} ${
        isLeaving ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-slide-up'
      }`}
      role="alert"
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">{icons[type]}</span>
          <p className="flex-1 font-medium text-sm">{message}</p>
          <button
            onClick={handleClose}
            className="text-current opacity-70 hover:opacity-100 transition-opacity text-xl leading-none flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
      {/* Progress bar */}
      {duration > 0 && (
        <div className="h-0.5 bg-black/20">
          <div
            className={`h-full ${style.progress} transition-all duration-100 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
