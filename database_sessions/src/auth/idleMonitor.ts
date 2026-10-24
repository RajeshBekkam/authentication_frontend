import { useEffect, useState, useSyncExternalStore } from 'react';
import { broadcastAuth } from './authChannel';

// The server enforces a 30-minute sliding idle timeout; the client only warns (PRD 6.2).
export const IDLE_WARNING_MS = 25 * 60 * 1000;
export const ABSOLUTE_WARNING_MS = 10 * 60 * 1000;
const BROADCAST_THROTTLE_MS = 30 * 1000;

let lastActivity = Date.now();
let lastBroadcast = 0;
const listeners = new Set<() => void>();

function set(at: number) {
  if (at <= lastActivity) return;
  lastActivity = at;
  for (const l of listeners) l();
}

/** A successful API call in this tab slid the shared session; tell other tabs (throttled). */
export function recordActivity(): void {
  const now = Date.now();
  set(now);
  if (now - lastBroadcast > BROADCAST_THROTTLE_MS) {
    lastBroadcast = now;
    broadcastAuth({ type: 'activity', at: now });
  }
}

export function recordRemoteActivity(at: number): void {
  set(Math.min(at, Date.now()));
}

export function getLastActivity(): number {
  return lastActivity;
}

export function useLastActivity(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => lastActivity,
  );
}

/** Re-renders every `intervalMs` with the current time. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
