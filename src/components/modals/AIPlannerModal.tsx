import { useState } from 'react';
import { Sparkles, SlidersHorizontal, Check, X } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { HybridTrip, Stay, NightAccommodation } from '@/domain/types';
import { generateHybridItinerary, AIHybridStay } from '@/aiService';

function AIPlannerModal({
  trip,
  settings,
  onSettingsChange,
  onClose,
  onApply,
}: {
  trip: HybridTrip;
  settings: { apiKey: string; model: string };
  onSettingsChange: (s: { apiKey: string; model: string }) => void;
  onClose: () => void;
  onApply: (stays: Stay[]) => void;
}) {
  const [tab, setTab] = useState<'generate' | 'settings'>('generate');
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'scratch' | 'refine'>('scratch');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [pendingStays, setPendingStays] = useState<Stay[] | null>(null);

  const handleGenerate = async () => {
    if (!settings.apiKey.trim()) {
      setError('Please add your Gemini API key in the Settings tab.');
      setTab('settings');
      return;
    }
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setExplanation(null);
    setPendingStays(null);
    try {
      const result = await generateHybridItinerary(
        prompt,
        { apiKey: settings.apiKey, model: settings.model },
        trip.totalDays,
        trip.startDate,
        trip.name,
        mode,
        mode === 'refine'
          ? trip.stays.map((s) => ({
              name: s.name,
              startSlot: s.startSlot,
              endSlot: s.endSlot,
              visits: s.visits.map((v) => ({
                name: v.name,
                dayOffset: v.dayOffset,
                dayPart: v.dayPart,
              })),
            }))
          : undefined,
      );
      // Map AI output → app Stay type
      const newStays: Stay[] = (result.stays as AIHybridStay[]).map((s, i) => {
        // Parse nightAccommodations from AI response
        const rawAccom = (s as unknown as Record<string, unknown>).nightAccommodations as
          | Record<
              string,
              {
                name: string;
                lat?: number;
                lng?: number;
                cost?: number;
                notes?: string;
                link?: string;
              }
            >
          | undefined;
        const nightAccommodations: Record<number, NightAccommodation> | undefined = rawAccom
          ? Object.fromEntries(
              Object.entries(rawAccom).map(([k, v]) => [
                Number(k),
                {
                  name: v.name,
                  lat: v.lat,
                  lng: v.lng,
                  cost: v.cost,
                  notes: v.notes,
                  link: v.link,
                },
              ]),
            )
          : undefined;

        return {
          id: `ai-stay-${Date.now()}-${i}`,
          name: s.name,
          color: s.color,
          startSlot: s.startSlot,
          endSlot: s.endSlot,
          centerLat: s.centerLat,
          centerLng: s.centerLng,
          lodging: s.lodging ?? '',
          nightAccommodations:
            nightAccommodations && Object.keys(nightAccommodations).length > 0
              ? nightAccommodations
              : undefined,
          travelModeToNext: s.travelModeToNext ?? 'train',
          travelDurationToNext: s.travelDurationToNext,
          travelNotesToNext: s.travelNotesToNext,
          visits: (s.visits ?? []).map((v, vi) => ({
            id: `ai-visit-${Date.now()}-${i}-${vi}`,
            name: v.name,
            type: v.type ?? 'landmark',
            area: v.area ?? '',
            lat: v.lat,
            lng: v.lng,
            dayOffset: v.dayOffset ?? 0,
            dayPart: v.dayPart ?? 'morning',
            order: v.order ?? vi,
            durationHint: v.durationHint,
            notes: v.notes,
          })),
        };
      });
      if (result.explanation) {
        setExplanation(result.explanation);
        setPendingStays(newStays);
      } else {
        onApply(newStays);
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (pendingStays) {
      onApply(pendingStays);
      onClose();
    }
  };

  return (
    <ModalBase title="AI Planner" onClose={onClose} width="max-w-lg">
      {/* Tabs */}
      <div className="flex border-b border-slate-100 -mx-6 px-6 mb-5 gap-4">
        {(['generate', 'settings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2.5 text-[11px] font-extrabold uppercase tracking-widest border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t === 'generate' ? (
              <>
                <Sparkles className="w-3 h-3 inline -mt-0.5 mr-1" />
                Generate
              </>
            ) : (
              <>
                <SlidersHorizontal className="w-3 h-3 inline -mt-0.5 mr-1" />
                Settings
              </>
            )}
          </button>
        ))}
      </div>

      {tab === 'generate' && (
        <div className="space-y-4">
          {/* Mode toggle */}
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">
              Mode
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              value={mode}
              onValueChange={(v) => {
                if (v) setMode(v as 'scratch' | 'refine');
              }}
              className="w-full"
            >
              <ToggleGroupItem value="scratch" className="flex-1 text-xs font-bold">
                From Scratch
              </ToggleGroupItem>
              <ToggleGroupItem value="refine" className="flex-1 text-xs font-bold">
                Refine Existing
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Prompt */}
          {!explanation ? (
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">
                What should I plan?{' '}
                <span className="text-slate-300 normal-case font-medium">
                  ({trip.totalDays} days available)
                </span>
              </label>
              <Textarea
                className="text-sm resize-none"
                rows={4}
                placeholder={`e.g. ${trip.totalDays} days in Japan — Tokyo, Kyoto, Osaka. Culture, food, and nature. Mid-budget, late May 2026.`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
                }}
                disabled={loading}
                autoFocus
              />
              {loading && (
                <div className="mt-3 space-y-2 animate-pulse">
                  <div className="h-2.5 bg-slate-100 rounded-full w-3/4" />
                  <div className="h-2.5 bg-slate-100 rounded-full w-1/2" />
                  <div className="h-2.5 bg-slate-100 rounded-full w-5/6" />
                  <p className="text-[11px] text-slate-400 font-medium pt-1">
                    Generating your itinerary…
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary">
                  AI Plan Ready
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed italic">{explanation}</p>
              <p className="text-[11px] text-slate-400 pt-1">
                Review the summary above, then apply to your timeline.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700 flex gap-2 items-start">
              <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            {explanation ? (
              <Button className="flex-1" onClick={handleApply}>
                <Check data-icon="inline-start" className="w-4 h-4" /> Apply to Timeline
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{' '}
                    Generating…
                  </span>
                ) : (
                  <>
                    <Sparkles data-icon="inline-start" className="w-4 h-4" /> Generate
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">
              Gemini API Key
            </label>
            <Input
              type="password"
              className="text-sm font-mono"
              placeholder="AIza…"
              value={settings.apiKey}
              onChange={(e) => onSettingsChange({ ...settings, apiKey: e.target.value })}
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Stored locally in your browser.{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Get a free key →
              </a>
            </p>
          </div>
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">
              Model
            </label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={settings.model}
              onValueChange={(v) => {
                if (v) onSettingsChange({ ...settings, model: v });
              }}
              className="flex flex-wrap gap-1.5 mb-2"
            >
              {[
                { id: 'gemini-3.1-flash-lite-preview', label: '3.1 Lite', badge: 'recommended' },
                { id: 'gemini-3-flash-preview', label: '3 Flash' },
                { id: 'gemini-3.1-pro-preview', label: '3.1 Pro' },
              ].map(({ id, label, badge }) => (
                <ToggleGroupItem
                  key={id}
                  value={id}
                  className="px-2.5 py-1 text-[11px] font-bold"
                >
                  {label}
                  {badge && settings.model !== id ? (
                    <span className="ml-1 text-slate-400 font-medium">★</span>
                  ) : (
                    ''
                  )}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Input
              type="text"
              className="text-sm font-mono"
              placeholder="or type a custom model ID"
              value={settings.model}
              onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })}
            />
          </div>
        </div>
      )}
    </ModalBase>
  );
}

export default AIPlannerModal;
