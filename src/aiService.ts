import { AISettings, Location } from './types';

export const generateAIItinerary = async (
  prompt: string,
  settings: AISettings,
  days: { id: string, date: string }[]
): Promise<Partial<Location>[]> => {
  
  const systemPrompt = `
    You are a professional travel planner. 
    Generate a detailed itinerary in JSON format.
    The itinerary consists of a list of locations/activities.
    
    Days available (ID and Date): ${JSON.stringify(days)}    
    Each location MUST follow this JSON structure:
    {
      "name": "Location Name",
      "lat": number,
      "lng": number,
      "notes": "Short description of what to do",
      "startDayId": "matching_day_id_from_provided_list",
      "startSlot": "morning" | "afternoon" | "evening",
      "duration": number (1 to 3 slots),
      "category": "sightseeing" | "dining" | "hotel" | "transit" | "other"
    }

    Return ONLY a JSON object with a "locations" array. Do not include markdown formatting or extra text.
    Try to group items logically and ensure lat/lng are accurate for the city mentioned.
  `;

  // Standard Gemini v1beta endpoint
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${settings.model || 'gemini-3-flash-preview'}:generateContent?key=${settings.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${systemPrompt}\n\nIMPORTANT: YOUR RESPONSE MUST BE A VALID JSON OBJECT. DO NOT WRAP IN MARKDOWN CODE BLOCKS.\n\nUser Request: ${prompt}`
        }]
      }]
    })
  });

  if (!response.ok) {
      const err = await response.json();
      const errorMsg = err.error?.message || err[0]?.error?.message || 'Failed to call Gemini API';
      throw new Error(errorMsg);
  }

  const data = await response.json();
  if (!data.candidates || data.candidates.length === 0) {
      throw new Error('AI returned no results. Check your prompt or safety settings.');
  }

  let content = data.candidates[0].content.parts[0].text;
  
  // Clean up potential markdown formatting
  content = content.replace(/```json/g, '').replace(/```/g, '').trim();
  
  try {
      const parsed = JSON.parse(content);
      return parsed.locations || [];
  } catch (e) {
      console.error("Failed to parse AI response:", content);
      throw new Error("AI returned an invalid response format. Please try again.");
  }
};