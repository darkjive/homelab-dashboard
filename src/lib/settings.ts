import { useCallback, useEffect, useRef, useState } from 'react';

const EVENT = 'homelab:settings-changed';

export function getSetting<T>(key: string, fallback: T, parser?: (raw: string) => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return parser ? parser(raw) : (raw as unknown as T);
  } catch {
    return fallback;
  }
}

export function getSettingJSON<T>(key: string, fallback: T): T {
  return getSetting(key, fallback, raw => {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  });
}

export function setSetting(key: string, value: unknown): void {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { key } }));
  } catch {
    // ignore quota / serialization errors
  }
}

export function setSettingRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { key } }));
  } catch {
    // ignore
  }
}

export function useSetting<T>(
  key: string,
  fallback: T,
  parser?: (raw: string) => T
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => getSetting(key, fallback, parser));

  // Refs keep the listener effect keyed on `key` only — fallback/parser are
  // typically inline literals whose identity changes every render.
  const fallbackRef = useRef(fallback);
  const parserRef = useRef(parser);
  useEffect(() => {
    fallbackRef.current = fallback;
    parserRef.current = parser;
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key: string } | undefined;
      if (!detail || detail.key === key) {
        setValue(getSetting(key, fallbackRef.current, parserRef.current));
      }
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [key]);

  // Stable identity so callers can safely list the setter in dependency arrays
  const update = useCallback((v: T) => setSetting(key, v), [key]);

  return [value, update];
}

export function useSettingJSON<T>(key: string, fallback: T): [T, (v: T) => void] {
  return useSetting(key, fallback, raw => {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  });
}
