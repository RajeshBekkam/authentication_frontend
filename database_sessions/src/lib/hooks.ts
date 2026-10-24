import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Countdown for 429 responses. `start(seconds)` begins it; `remaining` is 0 when submitting is allowed.
 */
export function useRetryCountdown() {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until === null) return;
    const t = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) setUntil(null);
    }, 250);
    return () => clearInterval(t);
  }, [until]);

  const remaining = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
  return {
    remaining,
    start(seconds: number) {
      const current = Date.now();
      setNow(current);
      setUntil(current + seconds * 1000);
    },
  };
}
