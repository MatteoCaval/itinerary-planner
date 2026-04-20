import { useCallback, useEffect, useRef, useState } from 'react';

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });

  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const update = useCallback((next: T) => {
    setValue(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(keyRef.current, JSON.stringify(next));
    } catch {
      // quota exceeded / disabled — fail silently
    }
  }, []);

  return [value, update];
}
