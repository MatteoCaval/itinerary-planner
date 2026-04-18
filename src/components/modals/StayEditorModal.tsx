import { useState } from 'react';
import { Trash2, Inbox } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Stay } from '@/domain/types';
import { STAY_COLORS } from '@/domain/constants';

function StayEditorModal({
  stay,
  onClose,
  onSave,
  onDelete,
  onDemote,
  visitCount = 0,
}: {
  stay: Stay;
  onClose: () => void;
  onSave: (updates: Partial<Stay>) => void;
  onDelete: () => void;
  onDemote?: () => void;
  visitCount?: number;
}) {
  const [name, setName] = useState(stay.name);
  const [color, setColor] = useState(stay.color);
  const [confirmingDemote, setConfirmingDemote] = useState(false);

  return (
    <ModalBase title="Edit Stay" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
            Destination Name
          </label>
          <Input
            className="text-xs font-semibold"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
            Color
          </label>
          <div className="flex gap-2 flex-wrap">
            {STAY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                className={`size-9 rounded-full border-2 transition-all focus-visible:ring-2 focus-visible:ring-primary/50 ${color === c ? 'ring-2 ring-offset-2 ring-muted-foreground scale-110' : 'border-white hover:scale-110'}`}
                style={{ background: c }}
              />
            ))}
            <div className="flex flex-col items-center gap-0.5">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-9 rounded-full border-2 border-border cursor-pointer"
                aria-label="Pick custom color"
                title="Custom color"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 data-icon="inline-start" className="w-3.5 h-3.5" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &ldquo;{stay.name}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes all {visitCount} scheduled {visitCount === 1 ? 'place' : 'places'}.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Stay
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {onDemote && (
            <AlertDialog open={confirmingDemote} onOpenChange={setConfirmingDemote}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Inbox data-icon="inline-start" className="w-3.5 h-3.5" /> Move to Inbox
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Move &ldquo;{stay.name}&rdquo; to inbox?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The destination moves out of the timeline. Its {visitCount} scheduled{' '}
                    {visitCount === 1 ? 'place' : 'places'} will be unscheduled and stay attached to
                    the destination — they&apos;ll reappear when you promote it back to the
                    timeline.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      onDemote();
                      onClose();
                    }}
                  >
                    Move to Inbox
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              onSave({ name, color });
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </ModalBase>
  );
}

export default StayEditorModal;
