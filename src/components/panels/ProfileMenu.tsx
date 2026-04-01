import React, { useState, useEffect } from 'react';
import { Download, Upload, User, LogIn, LogOut, Lock, Check, Compass } from 'lucide-react';
import AuthModalSimple from '@/components/modals/AuthModalSimple';
import type { HybridTrip } from '@/domain/types';
import { useAuth } from '@/context/AuthContext';
import { hybridTripToLegacy, normalizeTrip } from '@/domain/migration';
import { generateMarkdown, downloadMarkdown } from '@/markdownExporter';
import { addDaysTo } from '@/domain/dateUtils';

function ProfileMenu({ trip, onImport, onImportFromCode, onGoHome, onSignOut }: {
  trip: HybridTrip;
  onImport: (data: HybridTrip) => void;
  onImportFromCode: () => void;
  onGoHome: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { user, signOutUser } = useAuth();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-profile-menu]')) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(trip, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${trip.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setOpen(false);
  };

  const handleExportMarkdown = () => {
    const start = trip.startDate || new Date().toISOString().split('T')[0];
    const legacy = hybridTripToLegacy({ ...trip, startDate: start });
    const endDate = addDaysTo(new Date(start), trip.totalDays - 1).toISOString().split('T')[0];
    const md = generateMarkdown(legacy.days, legacy.locations as unknown as Parameters<typeof generateMarkdown>[1], legacy.routes, start, endDate);
    downloadMarkdown(md, `${trip.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.md`);
    setOpen(false);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        if (!parsed.stays || !parsed.name) {
          alert('Invalid trip file — expected a Chronos trip JSON with "name" and "stays".');
          return;
        }
        const imported = normalizeTrip({
          ...parsed,
          id: parsed.id || `trip-${Date.now()}`,
          startDate: parsed.startDate || '',
          totalDays: parsed.totalDays || 1,
        } as HybridTrip);
        onImport(imported);
      } catch {
        alert('Error reading file. Please ensure it is valid JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setOpen(false);
  };

  return (
    <div className="relative" data-profile-menu>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
      <button
        onClick={() => setOpen(!open)}
        className={`size-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all flex-shrink-0 ml-1 ${
          open ? 'bg-primary text-white border-primary'
            : user ? 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600'
            : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white'
        }`}
      >
        {user ? <span className="text-[11px] font-bold">{(user.email?.[0] ?? 'U').toUpperCase()}</span> : <User className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-2xl border border-slate-200/60 overflow-hidden z-50">

          {/* Header */}
          <div className={`px-4 pt-4 pb-3 ${user ? 'bg-emerald-50/60' : 'bg-slate-50/80'}`}>
            <div className="flex items-center gap-3">
              <div className={`size-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${user ? 'bg-emerald-500 text-white' : 'bg-primary/10 text-primary'}`}>
                {user ? (user.email?.[0] ?? 'U').toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-800 truncate leading-tight">
                  {user ? user.email : 'Guest User'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {user ? <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" /> : <Lock className="w-3 h-3 text-slate-300 flex-shrink-0" />}
                  <p className={`text-[11px] font-semibold ${user ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {user ? 'Synced to cloud' : 'Local storage only'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Trip data section */}
          <div className="px-2 pt-2 pb-1">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 px-2 mb-1">Trip data</p>
            <button onClick={handleExport} className="w-full flex items-center gap-2.5 px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left">
              <div className="size-6 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Download className="w-3 h-3 text-blue-500" />
              </div>
              Export JSON
            </button>
            <button onClick={handleExportMarkdown} className="w-full flex items-center gap-2.5 px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left">
              <div className="size-6 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Download className="w-3 h-3 text-blue-500" />
              </div>
              Export Markdown
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2.5 px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left">
              <div className="size-6 rounded-md bg-violet-50 flex items-center justify-center flex-shrink-0">
                <Upload className="w-3 h-3 text-violet-500" />
              </div>
              Import JSON
            </button>
            <button onClick={() => { onImportFromCode(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left">
              <div className="size-6 rounded-md bg-violet-50 flex items-center justify-center flex-shrink-0">
                <Download className="w-3 h-3 text-violet-500" />
              </div>
              Import from code
            </button>
          </div>

          {/* Navigation section */}
          <div className="px-2 pb-2 border-t border-slate-100 pt-2">
            <button onClick={() => { onGoHome(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left">
              <div className="size-6 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Compass className="w-3 h-3 text-slate-500" />
              </div>
              Back to start
            </button>
          </div>

          {/* Auth footer */}
          <div className="px-3 pb-3 pt-1 border-t border-slate-100">
            {user ? (
              <button
                onClick={async () => { await signOutUser(); onSignOut(); setOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            ) : (
              <button
                onClick={() => { setOpen(false); setShowAuth(true); }}
                className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-bold text-primary border border-primary/25 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in
              </button>
            )}
          </div>
        </div>
      )}
      {showAuth && <AuthModalSimple onClose={() => setShowAuth(false)} />}
    </div>
  );
}

export default ProfileMenu;
