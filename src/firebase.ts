import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child } from "firebase/database";
import { trackError } from './services/telemetry';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Helper to remove undefined values recursively (Firebase doesn't allow them)
const sanitizeForFirebase = (obj: unknown): unknown => {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirebase);
  }

  if (obj !== null && typeof obj === 'object') {
    const newObj: Record<string, unknown> = {};
    Object.entries(obj as Record<string, unknown>).forEach(([key, val]) => {
      if (val !== undefined) {
        newObj[key] = sanitizeForFirebase(val);
      }
    });
    return newObj;
  }

  return obj;
};

const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return 'Unknown cloud sync error';
};

export const saveItinerary = async (passcode: string, data: unknown): Promise<{ success: boolean; error?: string }> => {
  try {
    const sanitizedData = sanitizeForFirebase(data);
    await set(ref(db, 'itineraries/' + passcode), sanitizedData);
    return { success: true };
  } catch (error) {
    trackError('cloud_save_failed', error, { passcode });
    return { success: false, error: formatErrorMessage(error) };
  }
};

export const loadItinerary = async (passcode: string): Promise<{ success: boolean; data?: unknown; error?: string }> => {
  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `itineraries/${passcode}`));
    if (snapshot.exists()) {
      return { success: true, data: snapshot.val() };
    }
    return { success: false, error: "No itinerary found with this passcode" };
  } catch (error) {
    trackError('cloud_load_failed', error, { passcode });
    return { success: false, error: formatErrorMessage(error) };
  }
};
