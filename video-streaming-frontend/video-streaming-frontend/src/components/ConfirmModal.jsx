import React, { useEffect } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Sil',
  cancelLabel  = 'Ləğv et',
  onConfirm,
  onClose,
  danger = true,
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-army-800 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-army-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-primary-100 dark:bg-primary-900/30'
          }`}>
            {danger
              ? <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              : <Info className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            {message && (
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{message}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-army-700 hover:bg-gray-200 dark:hover:bg-army-600 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                : 'bg-primary-600 hover:bg-primary-700 active:bg-primary-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
