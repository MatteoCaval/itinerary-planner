import { useState } from 'react';
import { Share2, Copy, Check, RefreshCw, Trash2, Globe, Lock } from 'lucide-react';
import type { ShareCodeMode } from '@/domain/types';
import type { ShareCodeStatus } from '@/hooks/useShareCode';
import { Button } from '@/components/ui/button';
import ModalBase from '@/components/ui/ModalBase';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
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

  const handleCopy = async () => {
    if (!shareCode) return;
    await navigator.clipboard.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = async () => {
    await onCreateCode(mode);
  };

  const isLoading = status === 'loading';

  // ── Management view: existing share code ──
  if (shareCode) {
    return (
      <ModalBase
        title="Manage sharing"
        description="Manage your trip share code"
        onClose={onClose}
        width="max-w-sm"
        footer={{
          primary: (
            <Button onClick={onClose}>
              Close
            </Button>
          ),
        }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Share2 className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pt-1">
            Anyone with this code can import your trip.
          </p>
        </div>

        {/* Share code display */}
        <button
          onClick={handleCopy}
          aria-label="Copy share code"
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
          <p className="text-[11px] font-semibold text-success text-center mt-1">
            Copied to clipboard
          </p>
        )}

        {error && <ErrorMessage className="mt-2">{error}</ErrorMessage>}

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-3">
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

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
              >
                <Trash2 className="w-3 h-3" />
                Revoke share code
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke share code?</AlertDialogTitle>
                <AlertDialogDescription>
                  Anyone using this code loses access immediately. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRevoke}>Revoke</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </ModalBase>
    );
  }

  // ── Create view: no share code yet ──
  return (
    <ModalBase
      title="Share trip"
      description="Generate a share code for your trip"
      onClose={onClose}
      width="max-w-sm"
      footer={{
        primary: (
          <Button onClick={handleCreate} disabled={isLoading} className="gap-2">
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            Create share code
          </Button>
        ),
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Share2 className="w-4 h-4 text-primary" />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed pt-1">
          Generate a code that anyone can use to import this trip.
        </p>
      </div>

      {/* Mode picker */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setMode('readonly')}
          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
            mode === 'readonly'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-border/80'
          }`}
        >
          <Lock
            className={`w-4 h-4 mt-0.5 flex-shrink-0 ${mode === 'readonly' ? 'text-primary' : 'text-muted-foreground'}`}
          />
          <div>
            <p className="text-xs font-bold text-foreground">Read only</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Only you can push updates. Others can import and pull.
            </p>
          </div>
        </button>
        <button
          disabled
          className="flex items-start gap-3 p-3 rounded-lg border border-border text-left opacity-50 cursor-not-allowed"
        >
          <Globe className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs font-bold text-foreground">
              Anyone can update
              <span className="ml-1.5 text-[9px] font-extrabold uppercase tracking-wider text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                Coming soon
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Anyone with the code can push changes.
            </p>
          </div>
        </button>
      </div>

      {error && <ErrorMessage className="mt-3">{error}</ErrorMessage>}
    </ModalBase>
  );
}

export default ShareTripDialog;
