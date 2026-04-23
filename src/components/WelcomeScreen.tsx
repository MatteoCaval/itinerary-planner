import { useState } from 'react';
import { Plus, LogIn, Download } from 'lucide-react';
import TransportIcon from '@/components/ui/TransportIcon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import AuthModalSimple from '@/components/modals/AuthModalSimple';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

const stayPreviews = [
  { left: '4%', width: '28%', color: '#b8304f', label: 'Tokyo' },
  { left: '35%', width: '20%', color: '#c15a2a', label: 'Kyoto' },
  { left: '58%', width: '32%', color: '#2e3f8a', label: 'Osaka' },
];

const transitChips = [
  { left: '33%', mode: 'train' as const },
  { left: '56%', mode: 'flight' as const },
];

function WelcomeScreen({
  onCreateTrip,
  onLoadDemo,
  onImportFromCode,
}: {
  onCreateTrip: () => void;
  onLoadDemo: () => void;
  onImportFromCode: () => void;
}) {
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const reduce = useReducedMotion();

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-6 bg-white/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2.5 text-primary">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt=""
            aria-hidden="true"
            className="size-7 rounded-full shadow-sm"
          />
          <span className="text-sm font-extrabold tracking-tight">Viaz</span>
        </div>
        {!user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAuth(true)}
            className="text-muted-foreground hover:text-primary"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign in
          </Button>
        )}
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full">
          {/* Decorative timeline preview */}
          <div
            aria-hidden="true"
            role="presentation"
            className={cn('mb-10 relative h-16 w-full select-none', 'hidden md:block')}
          >
            {/* Track line */}
            <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none">
              <div className="h-px w-full bg-border" />
            </div>
            {/* Stay blocks */}
            {stayPreviews.map((s, i) => (
              <div
                key={i}
                className="absolute h-10 rounded-lg flex items-center px-3 gap-2"
                style={{
                  left: s.left,
                  width: s.width,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: s.color + '1a',
                  border: `1.5px solid ${s.color}47`,
                }}
              >
                <div
                  className="w-1 h-5 rounded-full flex-shrink-0"
                  style={{ background: s.color }}
                />
                <span className="text-[11px] font-bold truncate" style={{ color: s.color }}>
                  {s.label}
                </span>
              </div>
            ))}
            {/* Transit chips */}
            {transitChips.map((chip) => (
              <div
                key={chip.left}
                className="absolute flex items-center justify-center"
                style={{ left: chip.left, top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <div className="bg-white border border-border rounded-full p-1.5 shadow-sm z-10">
                  <TransportIcon mode={chip.mode} className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>

          <h1 className="text-[2.6rem] font-black text-foreground tracking-tight leading-none mb-3">
            Plan your next
            <br />
            <span className="text-primary">adventure.</span>
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-sm">
            A visual day-by-day planner with a timeline, interactive map, and AI-powered
            suggestions.
          </p>

          <div className="flex items-center gap-3">
            <Button
              onClick={onCreateTrip}
              className={cn('shadow-sm shadow-primary/20', !reduce && 'active:scale-95')}
            >
              <Plus className="w-4 h-4" />
              Plan a trip
            </Button>
            <Button variant="outline" onClick={onLoadDemo}>
              See a demo
            </Button>
            <Button variant="outline" onClick={onImportFromCode}>
              <Download className="w-4 h-4" />
              Import from code
            </Button>
          </div>

          {!user && (
            <p className="mt-6 text-[11px] text-muted-foreground">
              Trips are saved locally.{' '}
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowAuth(true)}
                className="p-0 h-auto text-[11px]"
              >
                Sign in
              </Button>{' '}
              to sync across devices.
            </p>
          )}
        </div>
      </main>

      {showAuth && <AuthModalSimple onClose={() => setShowAuth(false)} />}
    </div>
  );
}

export default WelcomeScreen;
