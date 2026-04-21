import * as React from 'react';
import {
  ChevronRight,
  ChevronUp,
  FolderKanban,
  Calendar,
  Inbox,
  History,
  Download,
  Upload,
  FileText,
  Sparkles,
  Share2,
  UserCircle2,
  Cloud,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileSyncStatus = 'saved' | 'saving' | 'error' | 'local';

interface MoreTabProps {
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
        'w-full flex items-center gap-3 px-4 py-3 bg-white border-b border-border',
        'text-left',
        onClick && !disabled ? 'hover:bg-muted/50 active:bg-muted' : 'cursor-default',
      )}
    >
      <Icon className="size-4 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 text-sm font-medium text-foreground truncate">{label}</span>
      {badge}
      {trailing ??
        (onClick && !disabled ? (
          <ChevronRight className="size-4 text-muted-foreground" />
        ) : null)}
    </button>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-4 pt-4 pb-1.5">
      {children}
    </div>
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
      <SectionHeader>Trip</SectionHeader>
      <Row icon={FolderKanban} label="Switch trip" onClick={props.onSwitchTrip} />
      <Row icon={Calendar} label="Edit trip" onClick={props.onEditTrip} />

      <SectionHeader>Destinations</SectionHeader>
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
      {inboxOpen && props.renderInbox && (
        <div className="bg-muted/30 border-b border-border">{props.renderInbox()}</div>
      )}
      <Row icon={History} label="History" onClick={props.onOpenHistory} />

      <SectionHeader>Data</SectionHeader>
      <Row icon={Upload} label="Import from code" onClick={props.onImportCode} />
      <Row icon={FileText} label="Export markdown" onClick={props.onExportMarkdown} />
      <Row icon={Download} label="Export JSON" onClick={props.onExportJson} />
      <Row icon={Upload} label="Import JSON" onClick={props.onImportJson} />

      <SectionHeader>Power</SectionHeader>
      <Row icon={Sparkles} label="AI Planner" onClick={props.onOpenAIPlanner} />
      <Row icon={Share2} label="Share trip" onClick={props.onOpenShare} />

      <SectionHeader>Account</SectionHeader>
      {props.isAuthenticated && props.authEmail ? (
        <Row icon={UserCircle2} label={props.authEmail} onClick={props.onOpenAuth} />
      ) : (
        <Row icon={UserCircle2} label="Sign in" onClick={props.onOpenAuth} />
      )}
      <Row icon={Cloud} label={syncLabel} />

      <SectionHeader>App</SectionHeader>
      <Row
        icon={HelpCircle}
        label="Help & shortcuts"
        trailing={<span className="text-[10px] text-muted-foreground">Soon</span>}
      />
      <div className="px-4 py-3 text-[10px] text-muted-foreground">
        Version {props.version}
      </div>
    </div>
  );
}
