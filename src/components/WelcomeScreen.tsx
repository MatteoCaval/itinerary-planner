import { Compass, Plus, LogIn } from 'lucide-react';
import TransportIcon from '@/components/ui/TransportIcon';
import { useAuth } from '@/context/AuthContext';

function WelcomeScreen({ onCreateTrip, onLoadDemo }: { onCreateTrip: () => void; onLoadDemo: () => void }) {
  const { user, signInWithGoogle } = useAuth();

  const stayPreviews = [
    { left: '4%', width: '28%', color: '#2167d7', label: 'Tokyo' },
    { left: '35%', width: '20%', color: '#615cf6', label: 'Kyoto' },
    { left: '58%', width: '32%', color: '#d78035', label: 'Osaka' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-slate-100 px-6 bg-white/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2.5 text-primary">
          <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Compass className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-extrabold tracking-tight">Itinerary</span>
        </div>
        {!user && (
          <button
            onClick={signInWithGoogle}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign in
          </button>
        )}
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full">

          {/* Decorative timeline preview */}
          <div className="mb-10 relative h-16 w-full select-none">
            {/* Track line */}
            <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none">
              <div className="h-px w-full bg-slate-200" />
            </div>
            {/* Stay blocks */}
            {stayPreviews.map((s, i) => (
              <div
                key={i}
                className="absolute h-10 rounded-lg flex items-center px-3 gap-2"
                style={{
                  left: s.left, width: s.width, top: '50%', transform: 'translateY(-50%)',
                  background: `color-mix(in srgb, ${s.color} 10%, white)`,
                  border: `1.5px solid color-mix(in srgb, ${s.color} 28%, transparent)`,
                }}
              >
                <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-[11px] font-bold truncate" style={{ color: s.color }}>{s.label}</span>
              </div>
            ))}
            {/* Transit chips */}
            {[{ left: '33%', mode: 'train' as const }, { left: '56%', mode: 'flight' as const }].map((chip) => (
              <div
                key={chip.left}
                className="absolute flex items-center justify-center"
                style={{ left: chip.left, top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <div className="bg-white border border-slate-200 rounded-full p-1.5 shadow-sm z-10">
                  <TransportIcon mode={chip.mode} className="w-3 h-3 text-slate-400" />
                </div>
              </div>
            ))}
          </div>

          <h1 className="text-[2.6rem] font-black text-slate-900 tracking-tight leading-none mb-3">
            Plan your next<br />
            <span className="text-primary">adventure.</span>
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-sm">
            A visual day-by-day planner with a timeline, interactive map,
            and AI-powered suggestions.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={onCreateTrip}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-all shadow-sm shadow-primary/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Plan a trip
            </button>
            <button
              onClick={onLoadDemo}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 bg-white rounded-lg hover:shadow-sm hover:border-slate-300 transition-all"
            >
              See a demo
            </button>
          </div>

          {!user && (
            <p className="mt-6 text-[11px] text-slate-400">
              Trips are saved locally.{' '}
              <button onClick={signInWithGoogle} className="text-primary font-semibold hover:underline">
                Sign in
              </button>{' '}
              to sync across devices.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export default WelcomeScreen;
