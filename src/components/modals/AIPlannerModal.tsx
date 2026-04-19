import { useState, useRef } from 'react';
import { Sparkles, SlidersHorizontal, Check } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import {
  HybridTrip,
  Stay,
  VisitItem,
  VisitType,
  Route,
  TravelMode,
  NightAccommodation,
} from '@/domain/types';
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
  onApply: (result: { stays: Stay[]; visits: VisitItem[]; routes: Route[] }) => void;
}) {
  const [tab, setTab] = useState<'generate' | 'settings'>('generate');
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'scratch' | 'refine'>('scratch');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<{
    stays: Stay[];
    visits: VisitItem[];
    routes: Route[];
  } | null>(null);
  const [loadingSlow, setLoadingSlow] = useState(false);

  const slowTimerRef = useRef<number | null>(null);

  const handleGenerate = async () => {
    if (!settings.apiKey.trim()) {
      setError('Please add your Gemini API key in the Settings tab.');
      setTab('settings');
      return;
    }
    if (!prompt.trim()) return;
    setLoading(true);
    setLoadingSlow(false);
    slowTimerRef.current = window.setTimeout(() => setLoadingSlow(true), 15000);
    setError(null);
    setExplanation(null);
    setPendingResult(null);
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
              visits: trip.visits
                .filter((v) => v.stayId === s.id)
                .map((v) => ({
                  name: v.name,
                  dayOffset: v.dayOffset,
                  dayPart: v.dayPart,
                })),
            }))
          : undefined,
      );
      // Map AI output → v2 app types (flat visits + routes)
      const allVisits: VisitItem[] = [];
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

        const stayId = `ai-stay-${Date.now()}-${i}`;

        // Extract visits for this stay into the flat list
        const stayVisits: VisitItem[] = (s.visits ?? []).map((v, vi) => ({
          id: `ai-visit-${Date.now()}-${i}-${vi}`,
          stayId,
          name: v.name,
          type: ((v.type as string) === 'area' || (v.type as string) === 'hotel'
            ? 'landmark'
            : (v.type ?? 'landmark')) as VisitType,
          lat: v.lat,
          lng: v.lng,
          dayOffset: v.dayOffset ?? 0,
          dayPart: v.dayPart ?? 'morning',
          order: v.order ?? vi,
          durationHint: v.durationHint,
          notes: v.notes,
        }));
        allVisits.push(...stayVisits);

        return {
          id: stayId,
          name: s.name,
          color: s.color,
          startSlot: s.startSlot,
          endSlot: s.endSlot,
          centerLat: s.centerLat,
          centerLng: s.centerLng,
          imageUrl: undefined,
          nightAccommodations:
            nightAccommodations && Object.keys(nightAccommodations).length > 0
              ? nightAccommodations
              : undefined,
        };
      });

      // Build routes from consecutive stays
      const routes: Route[] = [];
      for (let i = 0; i < newStays.length - 1; i++) {
        const aiStay = (result.stays as AIHybridStay[])[i];
        routes.push({
          fromStayId: newStays[i].id,
          toStayId: newStays[i + 1].id,
          mode: (aiStay.travelModeToNext ?? 'train') as TravelMode,
          duration: aiStay.travelDurationToNext,
          notes: aiStay.travelNotesToNext,
        });
      }

      const aiResult = { stays: newStays, visits: allVisits, routes };
      if (result.explanation) {
        setExplanation(result.explanation);
        setPendingResult(aiResult);
      } else {
        onApply(aiResult);
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setLoading(false);
      setLoadingSlow(false);
    }
  };

  const handleApply = () => {
    if (pendingResult) {
      onApply(pendingResult);
      onClose();
    }
  };

  const generateFooter =
    tab === 'generate'
      ? {
          cancel: (
            <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          ),
          primary: explanation ? (
            <Button size="sm" onClick={handleApply}>
              <Check data-icon="inline-start" className="w-4 h-4" /> Apply to Timeline
            </Button>
          ) : (
            <Button size="sm" onClick={handleGenerate} disabled={loading || !prompt.trim()}>
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
          ),
        }
      : undefined;

  return (
    <ModalBase title="AI Planner" onClose={onClose} width="max-w-lg" footer={generateFooter}>
      {/* Tabs */}
      <div className="flex border-b border-border mb-5 gap-4">
        {(['generate', 'settings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2.5 text-[11px] font-extrabold uppercase tracking-widest border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
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
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
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
              <label
                htmlFor="ai-prompt"
                className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block"
              >
                What should I plan?{' '}
                <span className="text-muted-foreground/50 normal-case font-medium">
                  ({trip.totalDays} days available)
                </span>
              </label>
              <Textarea
                id="ai-prompt"
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
                <div aria-live="polite" className="mt-3 space-y-2 animate-pulse">
                  <div className="h-2.5 bg-border rounded-full w-3/4" />
                  <div className="h-2.5 bg-border rounded-full w-1/2" />
                  <div className="h-2.5 bg-border rounded-full w-5/6" />
                  <p className="text-[11px] text-muted-foreground font-medium pt-1">
                    Generating your itinerary…
                  </p>
                  {loadingSlow && (
                    <p className="text-[11px] text-warning font-medium">
                      This is taking longer than usual — hang tight…
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-muted border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary">
                  AI Plan Ready
                </span>
              </div>
              <p className="text-xs text-foreground leading-relaxed italic max-h-40 overflow-y-auto">
                {explanation}
              </p>
              <p className="text-[11px] text-muted-foreground pt-1">
                Review the summary above, then apply to your timeline.
              </p>
            </div>
          )}

          {error && <ErrorMessage className="rounded-lg">{error}</ErrorMessage>}
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="ai-api-key"
              className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block"
            >
              Gemini API Key
            </label>
            <Input
              id="ai-api-key"
              type="password"
              className="text-sm font-mono"
              placeholder="Paste your API key"
              value={settings.apiKey}
              onChange={(e) => onSettingsChange({ ...settings, apiKey: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
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
            <label
              htmlFor="ai-model"
              className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block"
            >
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
                {
                  id: 'gemini-3.1-flash-lite-preview',
                  label: '3.1 Lite',
                  desc: 'Fast & free',
                  badge: 'recommended',
                },
                { id: 'gemini-3-flash-preview', label: '3 Flash', desc: 'Balanced' },
                { id: 'gemini-3.1-pro-preview', label: '3.1 Pro', desc: 'Best quality' },
              ].map(({ id, label, desc, badge }) => (
                <ToggleGroupItem key={id} value={id} className="px-2.5 py-1.5">
                  <div className="text-center">
                    <span className="text-[11px] font-bold">
                      {label}
                      {badge && settings.model !== id ? (
                        <span className="ml-1 text-muted-foreground font-medium">★</span>
                      ) : (
                        ''
                      )}
                    </span>
                    <span className="text-[8px] text-muted-foreground block">{desc}</span>
                  </div>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Input
              id="ai-model"
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
