import { Database } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

function MergeDialog({
  localCount,
  cloudCount,
  cloudTripNames,
  localTripNames,
  onMerge,
  onKeepLocal,
  onUseCloud,
  onDismiss,
}: {
  localCount: number;
  cloudCount: number;
  cloudTripNames: string[];
  localTripNames: string[];
  onMerge: () => void;
  onKeepLocal: () => void;
  onUseCloud: () => void;
  onDismiss: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DialogContent className="sm:max-w-sm p-5">
        <DialogDescription className="sr-only">
          Choose how to handle local and cloud trip data
        </DialogDescription>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Database className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-extrabold text-foreground text-sm">
                Trips found in your account
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                You have <strong className="text-foreground">{localCount} local</strong> and{' '}
                <strong className="text-foreground">{cloudCount} cloud</strong> trips. What would you
                like to do?
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Trip name lists */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-[11px]">
          <div className="bg-muted rounded-lg px-3 py-2" aria-label="Local trips">
            <span className="font-bold text-muted-foreground uppercase tracking-wide text-[11px]">
              Local
            </span>
            <ul className="mt-1 space-y-0.5">
              {localTripNames.map((name, i) => (
                <li key={i} className="text-foreground truncate">
                  {name || 'Untitled trip'}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-primary/5 rounded-lg px-3 py-2" aria-label="Cloud trips">
            <span className="font-bold text-primary/60 uppercase tracking-wide text-[11px]">
              Cloud
            </span>
            <ul className="mt-1 space-y-0.5">
              {cloudTripNames.map((name, i) => (
                <li key={i} className="text-foreground truncate">
                  {name || 'Untitled trip'}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            onClick={onMerge}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold"
          >
            <span>Merge everything</span>
            <span className="opacity-70 font-normal">{localCount + cloudCount} trips total</span>
          </Button>
          <Button
            variant="outline"
            onClick={onKeepLocal}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold"
          >
            <span>Keep local only</span>
            <span className="text-muted-foreground font-normal">overwrite cloud</span>
          </Button>
          <Button
            variant="outline"
            onClick={onUseCloud}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold"
          >
            <span>Use cloud only</span>
            <span className="text-muted-foreground font-normal">discard local</span>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="mt-3 w-full text-[11px] text-muted-foreground hover:text-foreground"
        >
          Decide later
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default MergeDialog;
