import { useSyncExternalStore } from "react";
import { isSupabaseConfigured } from "./supabase";

// "local"   → Supabase not configured, data lives only in this browser
// "syncing" → a request to Supabase is in flight
// "synced"  → last request succeeded
// "error"   → last request failed; localStorage still has everything
export type SyncStatus = "local" | "syncing" | "synced" | "error";

let status: SyncStatus = isSupabaseConfigured ? "syncing" : "local";
let inFlight = 0;
const listeners = new Set<() => void>();

function set(next: SyncStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((l) => l());
}

// Wrap every Supabase call so the header indicator reflects reality.
export async function tracked<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  if (!isSupabaseConfigured) return null;
  inFlight++;
  set("syncing");
  try {
    const result = await run();
    inFlight--;
    if (inFlight === 0) set("synced");
    return result;
  } catch (err) {
    inFlight--;
    console.error(`[supabase] ${label} failed:`, err);
    set("error");
    return null;
  }
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
    () => status
  );
}
