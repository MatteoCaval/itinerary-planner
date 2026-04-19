import React, { useState } from 'react';
import { Download, Upload, User, LogIn, LogOut, Lock, Check, Compass, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthModalSimple from '@/components/modals/AuthModalSimple';
import type { HybridTrip, V1HybridTrip } from '@/domain/types';
import { useAuth } from '@/context/AuthContext';
import {
  hybridTripToLegacy,
  normalizeTrip,
  needsMigrationToV2,
  migrateV1toV2,
} from '@/domain/migration';
import { generateMarkdown, downloadMarkdown } from '@/markdownExporter';
import { addDaysTo } from '@/domain/dateUtils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

function ProfileMenu({
  trip,
  onImport,
  onImportFromCode,
  onShareTrip,
  onGoHome,
  onSignOut,
}: {
  trip: HybridTrip;
  onImport: (data: HybridTrip) => void;
  onImportFromCode: () => void;
  onShareTrip: () => void;
  onGoHome: () => void;
  onSignOut: () => void;
}) {
  const [showAuth, setShowAuth] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { user, signOutUser } = useAuth();

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(trip, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trip.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    const start = trip.startDate || new Date().toISOString().split('T')[0];
    const legacy = hybridTripToLegacy({ ...trip, startDate: start });
    const endDate = addDaysTo(new Date(start), trip.totalDays - 1)
      .toISOString()
      .split('T')[0];
    const md = generateMarkdown(
      legacy.days,
      legacy.locations as unknown as Parameters<typeof generateMarkdown>[1],
      legacy.routes,
      start,
      endDate,
    );
    downloadMarkdown(
      md,
      `${trip.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.md`,
    );
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        if (!parsed.stays || !parsed.name) {
          toast.error('Invalid trip file — expected a Chronos trip JSON with "name" and "stays".');
          return;
        }
        let imported = normalizeTrip({
          ...parsed,
          id: parsed.id || `trip-${Date.now()}`,
          startDate: parsed.startDate || '',
          totalDays: parsed.totalDays || 1,
        } as HybridTrip);
        if (needsMigrationToV2(imported)) {
          imported = migrateV1toV2(imported as unknown as V1HybridTrip);
        }
        onImport(imported);
      } catch {
        toast.error('Error reading file. Please ensure it is valid JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`size-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all flex-shrink-0 ml-1 ${
              user
                ? 'bg-success text-success-foreground border-success/50 hover:bg-success/90'
                : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white'
            }`}
          >
            {user ? (
              <span className="text-[11px] font-bold">
                {(user.email?.[0] ?? 'U').toUpperCase()}
              </span>
            ) : (
              <User className="w-3.5 h-3.5" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 max-w-[calc(100vw-2rem)]">
          {/* Header */}
          <div className={`px-4 pt-4 pb-3 ${user ? 'bg-success/10' : 'bg-muted/80'}`}>
            <div className="flex items-center gap-3">
              <div
                className={`size-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${user ? 'bg-success text-success-foreground' : 'bg-primary/10 text-primary'}`}
              >
                {user ? (user.email?.[0] ?? 'U').toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p
                  className="text-xs font-extrabold text-foreground truncate leading-tight"
                  title={user ? (user.email ?? undefined) : undefined}
                >
                  {user ? user.email : 'Guest User'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {user ? (
                    <Check className="w-3 h-3 text-success flex-shrink-0" />
                  ) : (
                    <Lock className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
                  )}
                  <p
                    className={`text-[11px] font-semibold ${user ? 'text-success' : 'text-muted-foreground'}`}
                  >
                    {user ? 'Synced to cloud' : 'Local storage only'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Trip data section */}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">
            Trip data
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleExport}>
            <div className="size-6 rounded-md bg-info/10 flex items-center justify-center flex-shrink-0">
              <Download className="w-3 h-3 text-info" />
            </div>
            Export JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportMarkdown}>
            <div className="size-6 rounded-md bg-info/10 flex items-center justify-center flex-shrink-0">
              <Download className="w-3 h-3 text-info" />
            </div>
            Export Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <div className="size-6 rounded-md bg-violet-50 flex items-center justify-center flex-shrink-0">
              <Upload className="w-3 h-3 text-violet-500" />
            </div>
            Import JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onImportFromCode}>
            <div className="size-6 rounded-md bg-violet-50 flex items-center justify-center flex-shrink-0">
              <Download className="w-3 h-3 text-violet-500" />
            </div>
            Import from code
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onShareTrip}>
            <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Share2 className="w-3 h-3 text-primary" />
            </div>
            Share trip
          </DropdownMenuItem>

          {/* Navigation section */}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onGoHome}>
            <div className="size-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
              <Compass className="w-3 h-3 text-muted-foreground" />
            </div>
            Back to start
          </DropdownMenuItem>

          {/* Auth footer */}
          <DropdownMenuSeparator />
          <div className="px-3 pb-3 pt-1">
            {user ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await signOutUser();
                  onSignOut();
                }}
                className="w-full text-[11px] font-bold gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAuth(true)}
                className="w-full text-[11px] font-bold text-primary border-primary/25 bg-primary/5 hover:bg-primary/10 gap-2"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in
              </Button>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      {showAuth && <AuthModalSimple onClose={() => setShowAuth(false)} />}
    </div>
  );
}

export default ProfileMenu;
