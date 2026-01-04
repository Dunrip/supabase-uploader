import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' | 'warning' | 'info'
  onConfirm,
  onCancel,
  isLoading = false,
}) {
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Focus confirm button after animation
      setTimeout(() => confirmButtonRef.current?.focus(), 100);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const typeStyles = {
    danger: {
      icon: '🗑️',
      iconBg: 'bg-red-500/20',
      confirmBtn: 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-500/20',
    },
    warning: {
      icon: '⚠️',
      iconBg: 'bg-yellow-500/20',
      confirmBtn: 'bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 shadow-yellow-500/20',
    },
    info: {
      icon: 'ℹ️',
      iconBg: 'bg-blue-500/20',
      confirmBtn: 'bg-gradient-to-r from-dark-accent to-purple-600 hover:from-dark-accentHover hover:to-purple-500 shadow-dark-accent/20',
    },
  };

  const styles = typeStyles[type] || typeStyles.info;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel();
      }}
    >
      <div
        className="w-full max-w-md bg-dark-surface border border-dark-border rounded-2xl shadow-2xl animate-slide-up overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl ${styles.iconBg} flex items-center justify-center flex-shrink-0`}>
              <span className="text-2xl">{styles.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 id="modal-title" className="text-lg font-semibold text-dark-text">
                {title}
              </h3>
              <p className="mt-2 text-dark-textMuted text-sm leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-5 py-2.5 bg-dark-surfaceHover border border-dark-border rounded-xl text-dark-text font-medium hover:bg-dark-border hover:border-dark-textMuted/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2.5 rounded-xl text-white font-medium transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2 ${styles.confirmBtn}`}
          >
            {isLoading ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
