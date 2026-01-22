import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child } from "firebase/database";

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

export const saveItinerary = async (passcode: string, data: any) => {
  try {
    await set(ref(db, 'itineraries/' + passcode), data);
    return { success: true };
  } catch (error: any) {
    console.error("Error saving itinerary:", error.code, error.message);
    return { success: false, error };
  }
};

export const loadItinerary = async (passcode: string) => {
  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `itineraries/${passcode}`));
    if (snapshot.exists()) {
      return { success: true, data: snapshot.val() };
    } else {
      return { success: false, error: "No itinerary found with this passcode" };
    }
  } catch (error: any) {
    console.error("Error loading itinerary:", error.code, error.message);
    return { success: false, error };
  }
};