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

export default function ModalBase({
  title,
  onClose,
  children,
  width = 'max-w-md',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn('max-h-[90dvh] flex flex-col gap-0 p-0', widthMap[width] ?? width)}
      >
        <DialogHeader className="px-4 py-2.5 border-b border-border flex-shrink-0">
          <DialogTitle className="font-extrabold text-xs tracking-wide">{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-4 py-3.5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
