import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/helpers';

export default function Modal({ isOpen, onClose, title, children, className = '' }) {
  useEffect(() => {
    if (!isOpen) return;

    // iOS Safari fix: body.overflow = 'hidden' doesn't stop background scroll on iOS.
    // Instead we lock the body position and compensate scroll offset,
    // which actually works on both iOS and Android.
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflowY = 'scroll'; // prevent layout shift from scrollbar

    return () => {
      // Restore scroll position on unmount/close
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflowY = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Panel
          overscroll-behavior: contain — stops iOS scroll-chaining through the modal
          to the page behind it (the "scroll bleeds through" bug). */}
      <div
        className={cn(
          'relative bg-surface w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl',
          'max-h-[85vh] overflow-y-auto',
          'animate-[slideUp_0.25s_ease-out]',
          'safe-bottom',
          className
        )}
        style={{
          animation: 'slideUp 0.25s ease-out',
          overscrollBehavior: 'contain', // prevent scroll chaining to background on iOS
          WebkitOverflowScrolling: 'auto', // modern iOS — no momentum quirks
        }}
      >
        {/* Handle bar for mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface transition-colors"
            >
              <X size={18} className="text-text-secondary" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-5 py-4">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
