import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseAuth } from '../firebase';
import { trackError } from '../services/telemetry';
import { ENABLE_ACCOUNT_AUTH } from '../constants/featureFlags';

type AuthActionResult = {
  success: boolean;
  error?: string;
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signInWithGoogle: () => Promise<AuthActionResult>;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  signOutUser: () => Promise<AuthActionResult>;
}

const unavailableResult: AuthActionResult = {
  success: false,
  error: ENABLE_ACCOUNT_AUTH
    ? 'Authentication is currently unavailable.'
    : 'Login and registration are coming soon.',
};

const defaultAuthContext: AuthContextType = {
  user: null,
  isLoading: false,
  signIn: async () => unavailableResult,
  signInWithGoogle: async () => unavailableResult,
  signUp: async () => unavailableResult,
  signOutUser: async () => unavailableResult,
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

const formatAuthError = (error: unknown): string => {
  const firebaseCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: string }).code || '')
    : '';

  switch (firebaseCode) {
    case 'auth/invalid-email':
      return 'Invalid email format.';
    case 'auth/email-already-in-use':
      return 'This email is already registered.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/popup-blocked':
      return 'Popup blocked by browser. Allow popups and try again.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup closed before completion.';
    case 'auth/account-exists-with-different-credential':
      return 'This email already exists with a different sign-in method.';
    default:
      return error instanceof Error ? error.message : 'Authentication request failed.';
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(ENABLE_ACCOUNT_AUTH);

  useEffect(() => {
    if (!ENABLE_ACCOUNT_AUTH) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      try {
        const [{ onAuthStateChanged }, auth] = await Promise.all([
          import('firebase/auth'),
          getFirebaseAuth(),
        ]);

        unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          if (!isActive) return;
          setUser(nextUser);
          setIsLoading(false);
        });
      } catch (error) {
        trackError('auth_init_failed', error);
        if (isActive) {
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isActive = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!ENABLE_ACCOUNT_AUTH) return unavailableResult;

    try {
      const [{ signInWithEmailAndPassword }, auth] = await Promise.all([
        import('firebase/auth'),
        getFirebaseAuth(),
      ]);

      await signInWithEmailAndPassword(auth, email.trim(), password);
      return { success: true };
    } catch (error) {
      trackError('auth_sign_in_failed', error, { emailLength: email.length });
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthActionResult> => {
    if (!ENABLE_ACCOUNT_AUTH) return unavailableResult;

    try {
      const [{ GoogleAuthProvider, signInWithPopup }, auth] = await Promise.all([
        import('firebase/auth'),
        getFirebaseAuth(),
      ]);

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      await signInWithPopup(auth, provider);
      return { success: true };
    } catch (error) {
      trackError('auth_google_sign_in_failed', error);
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!ENABLE_ACCOUNT_AUTH) return unavailableResult;

    try {
      const [{ createUserWithEmailAndPassword }, auth] = await Promise.all([
        import('firebase/auth'),
        getFirebaseAuth(),
      ]);

      await createUserWithEmailAndPassword(auth, email.trim(), password);
      return { success: true };
    } catch (error) {
      trackError('auth_sign_up_failed', error, { emailLength: email.length });
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const signOutUser = useCallback(async (): Promise<AuthActionResult> => {
    if (!ENABLE_ACCOUNT_AUTH) return unavailableResult;

    try {
      const [{ signOut }, auth] = await Promise.all([
        import('firebase/auth'),
        getFirebaseAuth(),
      ]);

      await signOut(auth);
      return { success: true };
    } catch (error) {
      trackError('auth_sign_out_failed', error);
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    isLoading,
    signIn,
    signInWithGoogle,
    signUp,
    signOutUser,
  }), [user, isLoading, signIn, signInWithGoogle, signUp, signOutUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
