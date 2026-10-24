import { useSyncExternalStore } from 'react';

export type ToastKind = 'success' | 'error' | 'info';
export type Toast = { id: number; kind: ToastKind; message: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const DISMISS_MS = 6000;

function emit() {
  for (const l of listeners) l();
}

export function showToast(message: string, kind: ToastKind = 'info'): void {
  // Collapse duplicates (e.g. several parallel 403s) into one toast.
  if (toasts.some((t) => t.message === message)) return;
  const toast = { id: nextId++, kind, message };
  toasts = [...toasts, toast];
  emit();
  setTimeout(() => dismissToast(toast.id), DISMISS_MS);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function clearToasts(): void {
  toasts = [];
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
}
