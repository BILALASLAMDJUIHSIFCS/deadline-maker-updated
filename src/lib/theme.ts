// Theme preference: applied instantly from localStorage (no flash on boot),
// with Supabase `app_settings` as the durable copy shared across devices.
// The newest `updatedAt` wins, the same rule tasks and todos use.

import { supabase } from "./supabase";
import { tracked } from "./sync";

export const THEME_IDS = [
  "classic",
  "brutal",
  "molten",
  "sphere",
  "dopamine",
  "citrus",
  "cobalt",
  "turbine",
  "bloom",
  "pixel",
  "honey",
  "porcelain",
] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: [string, string, string]; // background, surface, accent
  themeColor: string;
  group: "original" | "collection";
  mode: "dark" | "light";
  /** The theme's signature animation. */
  motion: string;
  /** Set when the theme's UI kit is built on a real third-party library. */
  engine?: string;
};

export const THEMES: ThemeMeta[] = [
  {
    id: "classic",
    group: "original",
    mode: "dark",
    name: "Classic Ember",
    tagline: "Original black + ember",
    motion: "Ember corner glow",
    swatch: ["#000000", "#161616", "#ff6f42"],
    themeColor: "#000000",
  },
  {
    id: "brutal",
    group: "original",
    mode: "light",
    name: "Neo Brutal",
    tagline: "Bold borders, hard shadows",
    motion: "Hard-shadow press",
    swatch: ["#ffde59", "#ffffff", "#ff4f7b"],
    themeColor: "#ffde59",
  },
  {
    id: "molten",
    group: "collection",
    mode: "dark",
    name: "Molten Switch",
    tagline: "Frosted graphite, molten orange",
    motion: "Cursor spotlight ignites every rim",
    engine: "shadcn/ui Switch · Radix",
    swatch: ["#17181b", "#2a2b30", "#ff6a1a"],
    themeColor: "#17181b",
  },
  {
    id: "sphere",
    group: "collection",
    mode: "dark",
    name: "Magic Sphere",
    tagline: "Iridescent orb on deep black",
    motion: "Live WebGL shader sphere",
    engine: "OGL · WebGL",
    swatch: ["#07050b", "#1a1222", "#d946ef"],
    themeColor: "#07050b",
  },
  {
    id: "dopamine",
    group: "collection",
    mode: "dark",
    name: "Dopamine Blur",
    tagline: "Squircle widgets, vivid blooms",
    motion: "Color fields drift inside cards",
    swatch: ["#26343a", "#3a1f4d", "#c4ff3a"],
    themeColor: "#26343a",
  },
  {
    id: "citrus",
    group: "collection",
    mode: "light",
    name: "Citrus Frost",
    tagline: "Milky glass on lime light",
    motion: "Receipt deck fans on hover",
    swatch: ["#d8d86a", "#f6f7ef", "#2f7d4f"],
    themeColor: "#d8d86a",
  },
  {
    id: "cobalt",
    group: "collection",
    mode: "dark",
    name: "Cobalt Wallet",
    tagline: "Electric blue glass, glossy pills",
    motion: "Orbiting rim light",
    swatch: ["#050a2e", "#121a4a", "#3d8bff"],
    themeColor: "#050a2e",
  },
  {
    id: "turbine",
    group: "collection",
    mode: "dark",
    name: "Turbine",
    tagline: "Device UI, mint gauges",
    motion: "Fan orb spins faster near deadline",
    swatch: ["#1a1b1d", "#242528", "#5ef2c2"],
    themeColor: "#1a1b1d",
  },
  {
    id: "bloom",
    group: "collection",
    mode: "dark",
    name: "Bloom",
    tagline: "Smoked glass over blurred lilies",
    motion: "Slow camera focus pull",
    swatch: ["#3a2a30", "#4a3a40", "#c4f07a"],
    themeColor: "#2a1d22",
  },
  {
    id: "pixel",
    group: "collection",
    mode: "dark",
    name: "Pixel Dial",
    tagline: "Dot-matrix digits, violet arcs",
    motion: "Seconds dial boots & sweeps",
    engine: "GSAP timelines",
    swatch: ["#120d1d", "#1d1530", "#9b6bff"],
    themeColor: "#120d1d",
  },
  {
    id: "honey",
    group: "collection",
    mode: "light",
    name: "Honey Task",
    tagline: "Warm glass, barcode progress",
    motion: "Barcode shimmer + sparkles",
    swatch: ["#ececea", "#ffd77a", "#e07b00"],
    themeColor: "#ececea",
  },
  {
    id: "porcelain",
    group: "collection",
    mode: "light",
    name: "Porcelain",
    tagline: "Soft white menus, keycaps",
    motion: "Magnetic hover pill",
    swatch: ["#f1f1f3", "#ffffff", "#ec4899"],
    themeColor: "#f1f1f3",
  },
];

type ThemePref = { theme: ThemeId; updatedAt: number };

const KEY = "deadline-maker:theme:v1";
const TABLE = "app_settings";
const SETTINGS_ID = "default";

export const isThemeId = (v: unknown): v is ThemeId =>
  typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);

export function loadThemePref(): ThemePref {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ThemePref>;
      if (isThemeId(parsed.theme)) {
        return { theme: parsed.theme, updatedAt: Number(parsed.updatedAt) || 0 };
      }
    }
  } catch {
    /* corrupt or unavailable storage — fall back to default */
  }
  return { theme: "classic", updatedAt: 0 };
}

function saveLocal(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pref));
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}

export function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  if (theme === "classic") delete root.dataset.theme;
  else root.dataset.theme = theme;

  const meta0 = THEMES.find((t) => t.id === theme);
  root.dataset.mode = meta0?.mode ?? "dark";
  const color = meta0?.themeColor ?? "#000000";
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
}

export async function fetchRemoteThemePref(): Promise<ThemePref | null> {
  const client = supabase;
  if (!client) return null;
  return tracked("fetch theme", async () => {
    const { data, error } = await client
      .from(TABLE)
      .select("theme, updated_at")
      .eq("id", SETTINGS_ID)
      .maybeSingle();
    if (error) throw error;
    if (!data || !isThemeId(data.theme)) return null;
    return { theme: data.theme, updatedAt: Number(data.updated_at) || 0 };
  });
}

async function pushThemePref(pref: ThemePref) {
  const client = supabase;
  if (!client) return;
  await tracked("save theme", async () => {
    const { error } = await client
      .from(TABLE)
      .upsert(
        { id: SETTINGS_ID, theme: pref.theme, updated_at: pref.updatedAt },
        { onConflict: "id" }
      );
    // 23514 = the database still has an older theme check constraint; keep the
    // choice on this device until the new-themes migration is applied.
    if (error?.code === "23514") {
      console.warn("[supabase] theme not saved remotely — run supabase/migrations/20261123000000_pause_and_new_themes.sql");
      return;
    }
    if (error) throw error;
  });
}

export function persistTheme(theme: ThemeId): ThemePref {
  const pref = { theme, updatedAt: Date.now() };
  saveLocal(pref);
  applyTheme(theme);
  void pushThemePref(pref);
  return pref;
}

// Reconcile local vs remote. Returns the winning theme so the UI can update.
export async function syncTheme(local: ThemePref): Promise<ThemeId> {
  const remote = await fetchRemoteThemePref();
  if (remote && remote.updatedAt > local.updatedAt) {
    saveLocal(remote);
    applyTheme(remote.theme);
    return remote.theme;
  }
  // Local is newer (or remote is empty) — make sure the database has it.
  if (local.updatedAt > 0 && (!remote || remote.updatedAt < local.updatedAt)) {
    void pushThemePref(local);
  }
  return local.theme;
}
