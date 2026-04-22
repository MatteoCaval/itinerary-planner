import * as React from 'react';
import {
  ChevronRight,
  ChevronUp,
  Calendar,
  Inbox,
  History,
  Download,
  Upload,
  FileText,
  Sparkles,
  Share2,
  UserCircle2,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileSyncStatus = 'saved' | 'saving' | 'error' | 'local';

interface MoreTabProps {
  activeTripName: string;
  activeTripDates: string;
  inboxCount: number;
  onSwitchTrip: () => void;
  onEditTrip: () => void;
  onOpenHistory: () => void;
  onImportCode: () => void;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onOpenAIPlanner: () => void;
  onOpenShare: () => void;
  onOpenAuth: () => void;
  isAuthenticated: boolean;
  authEmail: string | null;
  syncStatus: MobileSyncStatus;
  version: string;
  /** Renderer for the inline Inbox content — shown when the Inbox row is expanded. */
  renderInbox?: () => React.ReactNode;
}

function Row({
  icon: Icon,
  label,
  badge,
  onClick,
  trailing,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  trailing?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 bg-white border-b border-border last:border-b-0',
        'text-left',
        onClick && !disabled ? 'hover:bg-muted/50 active:bg-muted' : 'cursor-default',
      )}
    >
      <Icon className="size-4 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 text-sm font-medium text-foreground truncate">{label}</span>
      {badge}
      {trailing ??
        (onClick && !disabled ? <ChevronRight className="size-4 text-muted-foreground" /> : null)}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-5 pb-2">
      <h3 className="font-serif italic text-base text-foreground">{children}</h3>
      <div className="mt-1.5 h-px bg-border" />
    </div>
  );
}

interface LeadCardProps {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}

function LeadCard({ onClick, className, children, ariaLabel }: LeadCardProps) {
  const base = 'w-full bg-white border border-border rounded-xl p-4 text-left shadow-sm';
  if (!onClick) {
    return <div className={cn(base, className)}>{children}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(base, 'hover:bg-muted/30 active:bg-muted/50 transition-colors', className)}
    >
      {children}
    </button>
  );
}

export function MoreTab(props: MoreTabProps) {
  const [inboxOpen, setInboxOpen] = React.useState(false);

  const syncLabel = {
    saved: '● Synced',
    saving: '● Saving',
    error: '● Error',
    local: '● Local',
  }[props.syncStatus];

  return (
    <div className="flex-1 overflow-y-auto pb-safe bg-background">
      {/* ── Trip ── */}
      <SectionTitle>Trip</SectionTitle>
      <div className="mx-4">
        <LeadCard
          onClick={props.onSwitchTrip}
          ariaLabel={`Switch trip. Active: ${props.activeTripName}`}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Active trip
              </div>
              <div className="font-serif italic text-xl text-foreground leading-tight truncate mt-0.5">
                {props.activeTripName}
              </div>
              <div className="font-num text-[11px] text-muted-foreground mt-1">
                {props.activeTripDates}
              </div>
            </div>
            <ChevronRight className="size-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          </div>
        </LeadCard>
      </div>
      <div className="mt-2 bg-white border-y border-border">
        <Row icon={Calendar} label="Edit trip" onClick={props.onEditTrip} />
      </div>

      {/* ── Destinations ── */}
      <SectionTitle>Destinations</SectionTitle>
      <div className="bg-white border-y border-border">
        <Row
          icon={Inbox}
          label="Inbox"
          onClick={() => setInboxOpen((o) => !o)}
          badge={
            props.inboxCount > 0 ? (
              <span className="font-num text-[11px] font-bold text-primary min-w-[18px] text-center">
                {props.inboxCount}
              </span>
            ) : undefined
          }
          trailing={
            inboxOpen ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )
          }
        />
        <div
          aria-hidden={!inboxOpen}
          className={cn(
            'overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            inboxOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <div className="bg-muted/30 border-b border-border">
            {props.renderInbox?.()}
          </div>
        </div>
        <Row icon={History} label="History" onClick={props.onOpenHistory} />
      </div>

      {/* ── Data ── */}
      <SectionTitle>Data</SectionTitle>
      <div className="bg-white border-y border-border">
        <Row icon={Upload} label="Import from code" onClick={props.onImportCode} />
        <Row icon={FileText} label="Export markdown" onClick={props.onExportMarkdown} />
        <Row icon={Download} label="Export JSON" onClick={props.onExportJson} />
        <Row icon={Upload} label="Import JSON" onClick={props.onImportJson} />
      </div>

      {/* ── Power ── */}
      <SectionTitle>Power</SectionTitle>
      <div className="bg-white border-y border-border">
        <Row icon={Sparkles} label="AI Planner" onClick={props.onOpenAIPlanner} />
        <Row icon={Share2} label="Share trip" onClick={props.onOpenShare} />
      </div>

      {/* ── Account ── */}
      <SectionTitle>Account</SectionTitle>
      <div className="mx-4">
        {props.isAuthenticated && props.authEmail ? (
          <LeadCard onClick={props.onOpenAuth} ariaLabel="Account settings">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <UserCircle2 className="size-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">
                  {props.authEmail}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-1.5 rounded-full',
                      props.syncStatus === 'saved' && 'bg-success',
                      props.syncStatus === 'saving' && 'bg-amber-500 animate-pulse',
                      props.syncStatus === 'error' && 'bg-destructive',
                      props.syncStatus === 'local' && 'bg-muted-foreground',
                    )}
                  />
                  {syncLabel.replace('● ', '')}
                </div>
              </div>
              <ChevronRight className="size-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
            </div>
          </LeadCard>
        ) : (
          <LeadCard onClick={props.onOpenAuth} ariaLabel="Sign in">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <UserCircle2 className="size-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">Sign in</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Sync your trip across devices
                </div>
              </div>
              <ChevronRight className="size-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
            </div>
          </LeadCard>
        )}
      </div>

      {/* ── App ── */}
      <SectionTitle>App</SectionTitle>
      <div className="bg-white border-y border-border">
        <Row
          icon={HelpCircle}
          label="Help & shortcuts"
          trailing={<span className="text-[10px] text-muted-foreground">Soon</span>}
        />
      </div>
      <div className="px-4 py-3 text-[10px] text-muted-foreground">Version {props.version}</div>
    </div>
  );
}
