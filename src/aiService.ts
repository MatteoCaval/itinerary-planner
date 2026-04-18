// AISettings was previously in ./types — inlined here since the legacy types file was removed
type AISettings = { apiKey: string; model: string };
type Location = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  subLocations?: Location[];
  [key: string]: unknown;
};
type Route = { id: string; fromLocationId: string; toLocationId: string; [key: string]: unknown };
type Day = { id: string; date: string; [key: string]: unknown };
import { ApiError, fetchJson } from './services/httpClient';
import { trackError } from './services/telemetry';
import { DEFAULT_AI_MODEL } from './constants/daySection';
import { STAY_COLORS } from './domain/constants';

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

const getGeminiErrorMessage = (error: unknown, model: string): string => {
  if (error instanceof ApiError) {
    const details = error.details as { error?: { message?: string } } | string | undefined;

    const detailMessage = typeof details === 'string' ? details : details?.error?.message;

    if (error.code === 'request_aborted') {
      return 'Gemini request timed out. Try again, shorten the prompt, or use a faster model.';
    }

    if (error.status === 401 || error.status === 403) {
      return 'Gemini API key is invalid or missing permissions. Check your API key in AI Settings.';
    }

    if (error.status === 404) {
      return `Gemini model "${model}" was not found. Update the model name in AI Settings.`;
    }

    if (error.status === 429) {
      return 'Gemini rate limit reached. Please wait a moment and retry.';
    }

    if (detailMessage) {
      return `Gemini error: ${detailMessage}`;
    }

    return `Gemini request failed (status ${error.status ?? 'unknown'}).`;
  }

  if (error instanceof Error) return error.message;
  return 'Gemini API Error';
};

export const generateAIItinerary = async (
  prompt: string,
  settings: AISettings,
  days: { id: string; date: string }[],
  currentLocations: Location[],
  currentRoutes: Route[],
  mode: 'scratch' | 'refactor',
): Promise<{
  locations: Partial<Location>[];
  routes: Partial<Route>[];
  days?: Partial<Day>[];
  explanation?: string;
}> => {
  const selectedModel = settings.model?.trim() || DEFAULT_AI_MODEL;

  const systemPrompt = `
    You are a professional travel planner. 
    Generate a detailed itinerary in JSON format.
    
    The itinerary uses two main types of data:
    1. LOCATIONS: Specific spots to visit (restaurants, museums, etc.).
    2. ROUTES: The travel/transit between two locations (trains, walks, etc.).
    
    NESTING & SUB-ITINERARIES (NEW):
    - Locations can have "subLocations". Use this for major destinations (cities) where the user stays for multiple days.
    - Example: If visiting Tokyo for 3 days, create a single top-level Location "Tokyo" spanning 9 slots (3 days). Inside it, add "subLocations" for specific Tokyo spots (Shibuya, Senso-ji, etc.).
    - Sub-locations use "dayOffset" (0-based) instead of "startDayId". "dayOffset: 0" means the first day of the stay in that city.
    - Sub-locations may share the same "startSlot" on the same "dayOffset" when multiple activities happen in the same part of the day.
    
    ACCOMMODATIONS:
    - Each day can have an "accommodation" with a "name", "lat", "lng", and "notes".
    - If the user is staying in the same hotel for multiple days, repeat the accommodation info for those days.
    
    SLOT CONSTRAINTS (CRITICAL):
    - A day has exactly 3 slots: "morning", "afternoon", "evening".
    - Top-level locations: You CANNOT have more than one Location per slot at the same level.
    - Sub-locations: You MAY include multiple subLocations in the same slot for the same dayOffset.
    - If you want multiple nearby activities at the same time of day for a top-level location, you MUST create a single Location entry and list both activities in the "notes" field.
    - An activity can have a "duration" of 1, 2, or 3 slots. Ensure durations do not cause overlaps.
    
    RULES:
    - Never create a "train ride" or "bus trip" as a Location. Instead, create two Locations and a Route connecting them.
    - If mode is 'refactor', consider the existing locations/routes provided and fill gaps or optimize.
    - If mode is 'scratch', ignore current data and build a fresh plan for the given days.
    - Always ensure coordinates (lat/lng) are accurate for the city.
    
    Days available (ID and Date): ${JSON.stringify(days)}
    
    Current Data (if refactoring):
    Locations: ${JSON.stringify(
      currentLocations.map((l) => ({
        id: l.id,
        name: l.name,
        category: l.category,
        notes: l.notes,
        cost: l.cost,
        startDayId: l.startDayId,
        startSlot: l.startSlot,
        duration: l.duration,
        subLocations: l.subLocations?.map((s) => ({
          name: s.name,
          category: s.category,
          notes: s.notes,
          cost: s.cost,
          dayOffset: s.dayOffset,
          startSlot: s.startSlot,
        })),
      })),
    )}
    Routes: ${JSON.stringify(
      currentRoutes.map((r) => ({
        transportType: r.transportType,
        duration: r.duration,
        cost: r.cost,
        notes: r.notes,
        fromLocationId: r.fromLocationId,
        toLocationId: r.toLocationId,
      })),
    )}

    OUTPUT JSON STRUCTURE (Strict):
    {
      "explanation": "Optional text explaining your choices or giving tips",
      "days": [
        {
          "id": "matching_day_id",
          "accommodation": {
            "name": "Hotel Name",
            "lat": number,
            "lng": number,
            "notes": "Booking info or address"
          }
        }
      ],
      "locations": [
        {
          "id": "temp_unique_id",
          "name": "Location Name",
          "lat": number,
          "lng": number,
          "notes": "Description",
          "startDayId": "matching_day_id",
          "startSlot": "morning" | "afternoon" | "evening",
          "duration": number (total slots),
          "category": "sightseeing" | "dining" | "hotel" | "transit" | "other",
          "subLocations": [
            {
              "id": "temp_sub_id",
              "name": "Sub Location Name",
              "lat": number,
              "lng": number,
              "dayOffset": number (0-based relative to parent start),
              "startSlot": "morning" | "afternoon" | "evening",
              "duration": number (1-3),
              "notes": "Details"
            },
            {
              "id": "temp_sub_id_2",
              "name": "Another Sub Location",
              "lat": number,
              "lng": number,
              "dayOffset": number (same dayOffset as above),
              "startSlot": "afternoon" (same slot allowed for subLocations),
              "duration": number (1-3),
              "notes": "Details"
            }
          ]
        }
      ],
      "routes": [
        {
          "id": "temp_route_id",
          "fromLocationId": "temp_unique_id",
          "toLocationId": "temp_unique_id",
          "transportType": "walk" | "car" | "bus" | "train" | "flight" | "ferry" | "other",
          "duration": "e.g. 20 mins",
          "notes": "Transit details"
        }
      ]
    }

    Return ONLY the valid JSON object. No markdown, no pre-amble.
  `;
  let data: GeminiResponse;
  try {
    data = await fetchJson<GeminiResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${settings.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${systemPrompt}\n\nMode: ${mode}\nUser Request: ${prompt}` }],
            },
          ],
        }),
        retries: 1,
        retryDelayMs: 500,
        timeoutMs: 60000,
      },
    );
  } catch (error) {
    trackError('ai_generate_failed', error, { mode, promptLength: prompt.length });
    throw new Error(getGeminiErrorMessage(error, selectedModel));
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('AI returned no results.');
  }

  let content = data.candidates[0].content?.parts?.[0]?.text || '';
  content = content
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(content);
    return {
      explanation: parsed.explanation,
      locations: parsed.locations || [],
      routes: parsed.routes || [],
      days: parsed.days || [],
    };
  } catch (error) {
    trackError('ai_invalid_json', error, { responsePreview: content.slice(0, 300) });
    throw new Error('AI returned invalid JSON format.');
  }
};

// ─── Hybrid (CHRONOS) format ──────────────────────────────────────────────────

export type AIHybridVisitType = 'landmark' | 'museum' | 'food' | 'walk' | 'shopping';
export type AIHybridDayPart = 'morning' | 'afternoon' | 'evening';
export type AIHybridTravelMode = 'train' | 'flight' | 'drive' | 'ferry' | 'bus' | 'walk';

export interface AIHybridVisit {
  id: string;
  name: string;
  type: AIHybridVisitType;
  lat: number;
  lng: number;
  dayOffset: number | null;
  dayPart: AIHybridDayPart | null;
  order: number;
  durationHint?: string;
  notes?: string;
}

export interface AIHybridStay {
  name: string;
  color: string;
  startSlot: number;
  endSlot: number;
  centerLat: number;
  centerLng: number;
  lodging: string;
  travelModeToNext: AIHybridTravelMode;
  travelDurationToNext?: string;
  travelNotesToNext?: string;
  visits: AIHybridVisit[];
}

export interface AIHybridResult {
  explanation?: string;
  stays: AIHybridStay[];
}

export const generateHybridItinerary = async (
  prompt: string,
  settings: AISettings,
  totalDays: number,
  startDate: string,
  tripName: string,
  mode: 'scratch' | 'refine',
  currentStays?: Array<{
    name: string;
    startSlot: number;
    endSlot: number;
    visits: Array<{ name: string; dayOffset: number | null; dayPart: string | null }>;
  }>,
): Promise<AIHybridResult> => {
  const selectedModel = settings.model?.trim() || DEFAULT_AI_MODEL;
  const totalSlots = totalDays * 3;

  const systemPrompt = `You are a professional travel planner. Generate a trip itinerary for a Gantt-style timeline app.

TRIP CONTEXT:
- Trip name: "${tripName}"
- Start date: ${startDate}
- Duration: ${totalDays} days (${totalSlots} slots total)

TIMELINE MODEL:
- Each day has exactly 3 slots: morning (index 0), afternoon (index 1), evening (index 2).
- Global slot formula: slot = day_index * 3 + part_index.
  Example: day 0 morning = slot 0, day 0 evening = slot 2, day 1 morning = slot 3, day 2 afternoon = slot 7.
- Stays are destination blocks that span a range of slots. They must fit within 0..${totalSlots} and must NOT overlap.
- A stay covering N days starts at day_X * 3 and ends at (day_X + N) * 3.
- Every slot across all ${totalDays} days MUST be covered by exactly one stay. No gaps between stays.

STAYS represent destinations (cities/regions). Each stay has:
- name: The destination name (city, region, etc.)
- startSlot / endSlot: The slot range on the timeline
- centerLat / centerLng: Geographic center coordinates (must be accurate)
- lodging: Primary hotel/accommodation name (can be empty)
- nightAccommodations: Per-night accommodation details (see schema below)
- travelModeToNext: How to reach the next destination
- visits: Activities and places to visit within this stay

VISITS are activities/places within a stay:
- dayOffset: 0-based day index within the stay (0 = first day of stay). Use null for unscheduled/wishlist items.
- dayPart: "morning" | "afternoon" | "evening". Use null for unscheduled items.
- Each scheduled visit must have both dayOffset and dayPart set.
- Multiple visits can share the same dayOffset + dayPart — they stack in that time slot.
- Aim for 2-4 visits per day, spread across morning/afternoon/evening.
- Include a mix of types: landmarks, museums, food spots, walks, shopping.
- The "area" field should be the neighborhood or district name.

NIGHT ACCOMMODATIONS:
- nightAccommodations is an object keyed by dayOffset (0-based within stay).
- Each entry has: name, lat, lng (optional), cost (optional), notes (optional), link (optional).
- Include accommodation for each night the traveler sleeps in that stay.
- The last day of a stay typically doesn't need accommodation (they travel to next destination).

${
  mode === 'refine' && currentStays?.length
    ? `EXISTING STAYS (refine, improve, or fill gaps — keep what works):
${JSON.stringify(currentStays, null, 2)}`
    : ''
}

Pick stay colors from this palette (cycle through): ${STAY_COLORS.join(', ')}

Return ONLY valid JSON (no markdown, no code fences, no prose outside JSON):
{
  "explanation": "2-3 sentence summary of the plan and key highlights",
  "stays": [
    {
      "name": "City Name",
      "color": "#b8304f",
      "startSlot": 0,
      "endSlot": 9,
      "centerLat": 35.6762,
      "centerLng": 139.6503,
      "lodging": "Hotel Name",
      "nightAccommodations": {
        "0": { "name": "Hotel Name", "lat": 35.68, "lng": 139.69 },
        "1": { "name": "Hotel Name", "lat": 35.68, "lng": 139.69 }
      },
      "travelModeToNext": "train",
      "travelDurationToNext": "2h 30m",
      "travelNotesToNext": "Shinkansen from Tokyo Station",
      "visits": [
        {
          "id": "v1",
          "name": "Activity Name",
          "type": "landmark",
          "area": "Neighborhood Name",
          "lat": 35.7148,
          "lng": 139.7967,
          "dayOffset": 0,
          "dayPart": "morning",
          "order": 0,
          "durationHint": "2h",
          "notes": "Brief useful description or tip"
        }
      ]
    }
  ]
}

Valid visit types: landmark, museum, food, walk, shopping, area
Valid travelModeToNext: train, flight, drive, ferry, bus, walk
Valid dayPart: morning, afternoon, evening`;

  let data: GeminiResponse;
  try {
    data = await fetchJson<GeminiResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${settings.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: `${systemPrompt}\n\nMode: ${mode}\nUser Request: ${prompt}` }] },
          ],
        }),
        retries: 1,
        retryDelayMs: 500,
        timeoutMs: 60000,
      },
    );
  } catch (error) {
    trackError('ai_hybrid_generate_failed', error, { mode, promptLength: prompt.length });
    throw new Error(getGeminiErrorMessage(error, selectedModel));
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('AI returned no results.');
  }

  let content = data.candidates[0].content?.parts?.[0]?.text || '';
  content = content
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(content);
    return {
      explanation: parsed.explanation,
      stays: parsed.stays || [],
    };
  } catch (error) {
    trackError('ai_hybrid_invalid_json', error, { responsePreview: content.slice(0, 300) });
    throw new Error('AI returned invalid JSON format.');
  }
};
