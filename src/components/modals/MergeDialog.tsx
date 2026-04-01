import { createPortal } from 'react-dom';
import { Database } from 'lucide-react';

function MergeDialog({ localCount, cloudCount, cloudTripNames, localTripNames, onMerge, onKeepLocal, onUseCloud, onDismiss }: {
  localCount: number;
  cloudCount: number;
  cloudTripNames: string[];
  localTripNames: string[];
  onMerge: () => void;
  onKeepLocal: () => void;
  onUseCloud: () => void;
  onDismiss: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 bg-black/30 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Database className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">Trips found in your account</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              You have <strong className="text-slate-700">{localCount} local</strong> and{' '}
              <strong className="text-slate-700">{cloudCount} cloud</strong> trips.
              What would you like to do?
            </p>
          </div>
        </div>

        {/* Trip name lists */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-[11px]">
          <div className="bg-slate-50 rounded-lg px-3 py-2">
            <span className="font-bold text-slate-500 uppercase tracking-wide text-[11px]">Local</span>
            <ul className="mt-1 space-y-0.5">
              {localTripNames.map((name, i) => (
                <li key={i} className="text-slate-700 truncate">{name || 'Untitled trip'}</li>
              ))}
            </ul>
          </div>
          <div className="bg-primary/5 rounded-lg px-3 py-2">
            <span className="font-bold text-primary/60 uppercase tracking-wide text-[11px]">Cloud</span>
            <ul className="mt-1 space-y-0.5">
              {cloudTripNames.map((name, i) => (
                <li key={i} className="text-slate-700 truncate">{name || 'Untitled trip'}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={onMerge}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            <span>Merge everything</span>
            <span className="opacity-70 font-normal">{localCount + cloudCount} trips total</span>
          </button>
          <button
            onClick={onKeepLocal}
            className="w-full flex items-center justify-between px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            <span>Keep local only</span>
            <span className="text-slate-400 font-normal">overwrite cloud</span>
          </button>
          <button
            onClick={onUseCloud}
            className="w-full flex items-center justify-between px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            <span>Use cloud only</span>
            <span className="text-slate-400 font-normal">discard local</span>
          </button>
        </div>

        <button
          onClick={onDismiss}
          className="mt-3 w-full text-center text-[11px] text-slate-400 hover:text-slate-600 transition-colors py-1"
        >
          Decide later
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default MergeDialog;
