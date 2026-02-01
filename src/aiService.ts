import { AISettings, Location, Route, Day } from './types';

export const generateAIItinerary = async (
  prompt: string,
  settings: AISettings,
  days: { id: string, date: string }[],
  currentLocations: Location[],
  currentRoutes: Route[],
  mode: 'scratch' | 'refactor'
): Promise<{ 
  locations: Partial<Location>[], 
  routes: Partial<Route>[], 
  days?: Partial<Day>[],
  explanation?: string 
}> => {
  
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
    
    ACCOMMODATIONS:
    - Each day can have an "accommodation" with a "name", "lat", "lng", and "notes".
    - If the user is staying in the same hotel for multiple days, repeat the accommodation info for those days.
    
    SLOT CONSTRAINTS (CRITICAL):
    - A day has exactly 3 slots: "morning", "afternoon", "evening".
    - You CANNOT have more than one Location per slot at the same level. 
    - If you want to suggest multiple nearby activities for the same time of day, you MUST create a single Location entry and list both activities in the "notes" field.
    - An activity can have a "duration" of 1, 2, or 3 slots. Ensure durations do not cause overlaps.
    
    RULES:
    - Never create a "train ride" or "bus trip" as a Location. Instead, create two Locations and a Route connecting them.
    - If mode is 'refactor', consider the existing locations/routes provided and fill gaps or optimize.
    - If mode is 'scratch', ignore current data and build a fresh plan for the given days.
    - Always ensure coordinates (lat/lng) are accurate for the city.
    
    Days available (ID and Date): ${JSON.stringify(days)}
    
    Current Data (if refactoring):
    Locations: ${JSON.stringify(currentLocations.map(l => ({ 
      id: l.id, 
      name: l.name, 
      startDayId: l.startDayId, 
      startSlot: l.startSlot,
      duration: l.duration,
      subLocations: l.subLocations?.map(s => ({ name: s.name, dayOffset: s.dayOffset, startSlot: s.startSlot }))
    })))}
    Routes: ${JSON.stringify(currentRoutes)}

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
  // Standard Gemini v1beta endpoint
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${settings.model || 'gemini-3-flash-preview'}:generateContent?key=${settings.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${systemPrompt}\n\nMode: ${mode}\nUser Request: ${prompt}` }]
      }]
    })
  });

  if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Gemini API Error');
  }

  const data = await response.json();
  if (!data.candidates || data.candidates.length === 0) {
      throw new Error('AI returned no results.');
  }

  let content = data.candidates[0].content.parts[0].text;
  content = content.replace(/```json/g, '').replace(/```/g, '').trim();
  
      try {
          const parsed = JSON.parse(content);
          return {
              explanation: parsed.explanation,
              locations: parsed.locations || [],
              routes: parsed.routes || [],
              days: parsed.days || []
          };
      } catch (e) {      console.error("AI Response was:", content);
      throw new Error("AI returned invalid JSON format.");
  }
};
