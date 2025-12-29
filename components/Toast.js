import { useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
  };

  const colors = {
    success: 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/50 text-green-400',
    error: 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500/50 text-red-400',
    info: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/50 text-blue-400',
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 min-w-[300px] max-w-md px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl animate-slide-up ${colors[type]}`}
      role="alert"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icons[type]}</span>
        <p className="flex-1 font-medium">{message}</p>
        <button
          onClick={onClose}
          className="text-current opacity-70 hover:opacity-100 transition-opacity text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}
