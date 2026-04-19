import type React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const widthMap: Record<string, string> = {
  'max-w-sm': 'sm:max-w-sm',
  'max-w-md': 'sm:max-w-md',
  'max-w-lg': 'sm:max-w-lg',
  'max-w-xl': 'sm:max-w-xl',
};

type FooterSlot = {
  destructive?: React.ReactNode;
  cancel?: React.ReactNode;
  primary?: React.ReactNode;
};

interface ModalBaseProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: FooterSlot;
  width?: string;
  accent?: 'none' | 'gradient';
}

export default function ModalBase({
  title,
  description,
  onClose,
  children,
  footer,
  width = 'max-w-md',
  accent = 'none',
}: ModalBaseProps) {
  const hasFooter =
    !!footer && (footer.destructive || footer.cancel || footer.primary);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          'max-h-[90dvh] flex flex-col gap-0 p-0 overflow-hidden',
          widthMap[width] ?? width,
        )}
      >
        {accent === 'gradient' && (
          <div
            aria-hidden="true"
            className="h-1 w-full bg-[linear-gradient(90deg,var(--primary-700),var(--primary-500))]"
          />
        )}
        <DialogHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <DialogTitle className="text-base font-semibold tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {description ?? `Dialog for: ${title}`}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto overflow-x-hidden flex-1 px-4 py-3.5">
          {children}
        </div>
        {hasFooter && (
          <div className="flex items-center gap-2 border-t border-border px-4 py-3">
            {footer?.destructive && (
              <div className="flex-shrink-0">{footer.destructive}</div>
            )}
            <div className="flex-1" />
            {footer?.cancel}
            {footer?.primary}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type { ModalBaseProps, FooterSlot };
