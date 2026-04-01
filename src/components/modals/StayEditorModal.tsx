import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { Stay } from '@/domain/types';
import { STAY_COLORS } from '@/domain/constants';

function StayEditorModal({ stay, onClose, onSave, onDelete }: {
  stay: Stay; onClose: () => void;
  onSave: (updates: Partial<Stay>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(stay.name);
  const [lodging, setLodging] = useState(stay.lodging);
  const [color, setColor] = useState(stay.color);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <ModalBase title="Edit Stay" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Destination Name</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none font-semibold"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Lodging</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            value={lodging}
            onChange={(e) => setLodging(e.target.value)}
            placeholder="Hotel name or area"
          />
        </div>
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Color</label>
          <div className="flex gap-2 flex-wrap">
            {STAY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                className={`size-9 rounded-full border-2 transition-all focus-visible:ring-2 focus-visible:ring-primary/50 ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'border-white hover:scale-110'}`}
                style={{ background: c }}
              />
            ))}
            <div className="flex flex-col items-center gap-0.5">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-9 rounded-full border-2 border-slate-200 cursor-pointer"
                aria-label="Pick custom color"
                title="Custom color"
              />
            </div>
          </div>
        </div>
        {confirmDelete ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-red-700 mb-2">
              Delete "{stay.name}"? This removes all {stay.visits.length} scheduled {stay.visits.length === 1 ? 'place' : 'places'}.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-colors">
                Keep
              </button>
              <button onClick={() => { onDelete(); onClose(); }} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors">
                Delete Stay
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 pt-2">
            <button onClick={() => setConfirmDelete(true)} className="py-2 px-3 border border-red-200 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-red-300">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50">
              Cancel
            </button>
            <button
              onClick={() => { onSave({ name, lodging, color }); onClose(); }}
              className="flex-1 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

export default StayEditorModal;
