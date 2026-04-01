import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function ModalBase({ title, onClose, children, width = 'max-w-md' }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: string;
}) {
  const backdropRef = React.useRef(false);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<Element | null>(null);

  useEffect(() => {
    // Remember the element that opened the modal so we can restore focus
    triggerRef.current = document.activeElement;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      // Focus trap: cycle Tab within the modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handler);

    // Auto-focus first focusable element inside modal
    requestAnimationFrame(() => {
      const first = modalRef.current?.querySelector<HTMLElement>('input, button, textarea, select, [tabindex]');
      first?.focus();
    });

    return () => {
      window.removeEventListener('keydown', handler);
      // Restore focus to the element that triggered the modal
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) backdropRef.current = true; }}
      onMouseUp={(e) => { if (e.target === e.currentTarget && backdropRef.current) onClose(); backdropRef.current = false; }}
    >
      <div ref={modalRef} className={`bg-white rounded-xl shadow-2xl w-full ${width} max-h-[90dvh] flex flex-col`}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 flex-shrink-0">
          <h3 className="font-extrabold text-slate-800 text-xs tracking-wide">{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="text-slate-400 hover:text-slate-600 p-2.5 -mr-1 rounded-lg hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3.5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
