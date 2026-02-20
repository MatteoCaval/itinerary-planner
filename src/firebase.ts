import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Database } from 'firebase/database';
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

let appPromise: Promise<FirebaseApp> | null = null;
let dbPromise: Promise<Database> | null = null;
let authPromise: Promise<Auth> | null = null;

const getFirebaseApp = async () => {
  if (!appPromise) {
    appPromise = (async () => {
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      if (getApps().length > 0) {
        return getApp();
      }
      return initializeApp(firebaseConfig);
    })();
  }
  return appPromise;
};

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { getDatabase } = await import('firebase/database');
      const app = await getFirebaseApp();
      return getDatabase(app);
    })();
  }
  return dbPromise;
}

export async function getFirebaseAuth() {
  if (!authPromise) {
    authPromise = (async () => {
      const { getAuth } = await import('firebase/auth');
      const app = await getFirebaseApp();
      return getAuth(app);
    })();
  }
  return authPromise;
}

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
    const { ref, set } = await import('firebase/database');
    const db = await getDb();
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
    const { ref, get, child } = await import('firebase/database');
    const db = await getDb();
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

export const saveUserTripStore = async (
  uid: string,
  tripStore: unknown,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { ref, set } = await import('firebase/database');
    const db = await getDb();
    await set(ref(db, `users/${uid}/tripStore`), sanitizeForFirebase(tripStore));
    return { success: true };
  } catch (error) {
    trackError('account_trip_store_save_failed', error, { uid });
    return { success: false, error: formatErrorMessage(error) };
  }
};

export const loadUserTripStore = async (
  uid: string,
): Promise<{ success: boolean; exists: boolean; data?: unknown; error?: string }> => {
  try {
    const { ref, get, child } = await import('firebase/database');
    const db = await getDb();
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `users/${uid}/tripStore`));

    if (snapshot.exists()) {
      return { success: true, exists: true, data: snapshot.val() };
    }

    return { success: true, exists: false };
  } catch (error) {
    trackError('account_trip_store_load_failed', error, { uid });
    return { success: false, exists: false, error: formatErrorMessage(error) };
  }
};
