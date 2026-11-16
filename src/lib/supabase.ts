import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase is optional: until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are
// set, `supabase` is null and the app runs purely on localStorage.
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        // Single-user app with no sign-in, so there is no session to keep.
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;
