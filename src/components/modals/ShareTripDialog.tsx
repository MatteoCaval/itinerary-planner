import { useState } from 'react';
import { Share2, Copy, Check, RefreshCw, Trash2, AlertCircle, Globe, Lock } from 'lucide-react';
import type { ShareCodeMode } from '@/domain/types';
import type { ShareCodeStatus } from '@/hooks/useShareCode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type ShareTripDialogProps = {
  shareCode: string | undefined;
  status: ShareCodeStatus;
  error: string | null;
  onCreateCode: (mode: ShareCodeMode) => Promise<string | undefined>;
  onPushUpdate: () => Promise<boolean>;
  onRevoke: () => Promise<boolean>;
  onClose: () => void;
};

function ShareTripDialog({
  shareCode,
  status,
  error,
  onCreateCode,
  onPushUpdate,
  onRevoke,
  onClose,
}: ShareTripDialogProps) {
  const [mode, setMode] = useState<ShareCodeMode>('readonly');
  const [copied, setCopied] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const handleCopy = async () => {
    if (!shareCode) return;
    await navigator.clipboard.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = async () => {
    await onCreateCode(mode);
  };

  const handleRevoke = async () => {
    const ok = await onRevoke();
    if (ok) {
      setShowRevokeConfirm(false);
    }
  };

  const isLoading = status === 'loading';

  // ── Management view: existing share code ──
  if (shareCode) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-sm p-5">
          <DialogDescription className="sr-only">Manage your trip share code</DialogDescription>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Share2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="font-extrabold text-foreground text-sm">
                  Trip shared
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Anyone with this code can import your trip.
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Share code display */}
          <button
            onClick={handleCopy}
            className="w-full mt-1 flex items-center justify-center gap-2 px-4 py-3 bg-muted rounded-lg border border-border hover:bg-muted/80 transition-colors group"
          >
            <span className="text-lg font-mono font-extrabold tracking-[0.2em] text-foreground">
              {shareCode}
            </span>
            {copied ? (
              <Check className="w-4 h-4 text-success flex-shrink-0" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 transition-colors" />
            )}
          </button>
          {copied && (
            <p className="text-[11px] font-semibold text-success text-center -mt-1">
              Copied to clipboard
            </p>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-destructive/10 text-red-600">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPushUpdate}
              disabled={isLoading}
              className="w-full text-xs font-bold gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Push latest changes
            </Button>

            {showRevokeConfirm ? (
              <div className="flex flex-col gap-2 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                <p className="text-xs text-destructive font-semibold">
                  This will permanently disable the share code. Anyone who has it won't be able to
                  import or pull updates.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRevokeConfirm(false)}
                    className="flex-1 text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRevoke}
                    disabled={isLoading}
                    className="flex-1 text-xs font-bold gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    Revoke
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRevokeConfirm(true)}
                className="w-full text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
              >
                <Trash2 className="w-3 h-3" />
                Revoke share code
              </Button>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-xs font-semibold"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Create view: no share code yet ──
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm p-5">
        <DialogDescription className="sr-only">Generate a share code for your trip</DialogDescription>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Share2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-extrabold text-foreground text-sm">
                Share trip
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Generate a code that anyone can use to import this trip.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Mode picker */}
        <div className="flex flex-col gap-2 mt-1">
          <button
            onClick={() => setMode('readonly')}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
              mode === 'readonly'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-border/80'
            }`}
          >
            <Lock className={`w-4 h-4 mt-0.5 flex-shrink-0 ${mode === 'readonly' ? 'text-primary' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-xs font-bold text-foreground">Read only</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Only you can push updates. Others can import and pull.
              </p>
            </div>
          </button>
          <button
            onClick={() => setMode('writable')}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
              mode === 'writable'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-border/80'
            }`}
          >
            <Globe className={`w-4 h-4 mt-0.5 flex-shrink-0 ${mode === 'writable' ? 'text-primary' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-xs font-bold text-foreground">Anyone can update</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Anyone with the code can push changes.
              </p>
            </div>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-destructive/10 text-red-600 mt-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-xs font-bold gap-2"
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            Generate code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShareTripDialog;
