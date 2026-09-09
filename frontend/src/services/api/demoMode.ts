import { useSyncExternalStore } from "react";

export const PUBLIC_DEMO_MESSAGE = "This public demo is read-only. Explore the seeded coaching and progress history. The local application supports the full workflow.";

// A deployment hint can prevent the first rejected mutation. Without it, only
// the backend's exact read-only response enables this state (never a generic 403).
let readOnly = import.meta.env.VITE_PUBLIC_DEMO_MODE === "true";
const listeners = new Set<() => void>();

export function markPublicDemoReadOnly() {
  readOnly = true;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function usePublicDemoReadOnly() {
  return useSyncExternalStore(subscribe, () => readOnly, () => readOnly);
}

export class PublicDemoReadOnlyError extends Error {
  constructor() {
    super(PUBLIC_DEMO_MESSAGE);
  }
}

export async function apiError(response: Response, fallback: string): Promise<Error> {
  let detail: unknown;
  try {
    const body = await response.json() as { detail?: unknown };
    detail = body.detail;
  } catch { /* Keep the fallback for non-JSON errors. */ }
  if (response.status === 403 && detail === "Hosted demo is read-only.") {
    markPublicDemoReadOnly();
    return new PublicDemoReadOnlyError();
  }
  return new Error(typeof detail === "string" ? detail : fallback);
}
