import { AISettings, Location, Route } from './types';

export const generateAIItinerary = async (
  prompt: string,
  settings: AISettings,
  days: { id: string, date: string }[],
  currentLocations: Location[],
  currentRoutes: Route[],
  mode: 'scratch' | 'refactor'
): Promise<{ locations: Partial<Location>[], routes: Partial<Route>[] }> => {
  
  const systemPrompt = `
    You are a professional travel planner. 
    Generate a detailed itinerary in JSON format.
    
    The itinerary uses two main types of data:
    1. LOCATIONS: Specific spots to visit (restaurants, museums, etc.).
    2. ROUTES: The travel/transit between two locations (trains, walks, etc.).
    
    SLOT CONSTRAINTS (CRITICAL):
    - A day has exactly 3 slots: "morning", "afternoon", "evening".
    - You CANNOT have more than one Location per slot. 
    - If you want to suggest multiple nearby activities for the same time of day (e.g., visiting two small shops in the morning), you MUST create a single Location entry and list both activities in the "notes" field.
    - An activity can have a "duration" of 1, 2, or 3 slots. Ensure durations do not cause overlaps (e.g., a duration 2 activity starting in "morning" occupies both "morning" and "afternoon").
    
    RULES:
    - Never create a "train ride" or "bus trip" as a Location. Instead, create two Locations and a Route connecting them.
    - If mode is 'refactor', consider the existing locations/routes provided and fill gaps or optimize.
    - If mode is 'scratch', ignore current data and build a fresh plan for the given days.
    - Always ensure coordinates (lat/lng) are accurate for the city. 
    
    Days available (ID and Date): ${JSON.stringify(days)}
    
    Current Data (if refactoring):
    Locations: ${JSON.stringify(currentLocations.map(l => ({ id: l.id, name: l.name, startDayId: l.startDayId, startSlot: l.startSlot })))} 
    Routes: ${JSON.stringify(currentRoutes)}

    OUTPUT JSON STRUCTURE (Strict):
    {
      "locations": [
        {
          "id": "temp_unique_id",
          "name": "Location Name",
          "lat": number,
          "lng": number,
          "notes": "Description",
          "startDayId": "matching_day_id",
          "startSlot": "morning" | "afternoon" | "evening",
          "duration": number (1-3),
          "category": "sightseeing" | "dining" | "hotel" | "transit" | "other"
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
          locations: parsed.locations || [],
          routes: parsed.routes || []
      };
  } catch (e) {
      console.error("AI Response was:", content);
      throw new Error("AI returned invalid JSON format.");
  }
};
