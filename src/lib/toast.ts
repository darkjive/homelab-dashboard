// Minimal event-based toast system: call toast('...') from anywhere, render
// <Toaster /> (src/components/Toaster.tsx) once in App. No provider needed.

export type ToastKind = 'error' | 'success' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export const TOAST_EVENT = 'homelab:toast';
let nextId = 0;

export function toast(message: string, kind: ToastKind = 'error'): void {
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, { detail: { id: ++nextId, kind, message } satisfies ToastItem })
  );
}
