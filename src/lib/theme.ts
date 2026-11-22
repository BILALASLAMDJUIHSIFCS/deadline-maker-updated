// Theme preference: applied instantly from localStorage (no flash on boot),
// with Supabase `app_settings` as the durable copy shared across devices.
// The newest `updatedAt` wins, the same rule tasks and todos use.

import { supabase } from "./supabase";
import { tracked } from "./sync";

export const THEME_IDS = [
  "classic",
  "glass",
  "brutal",
  "sage",
  "crt",
  "linear",
  "vercel",
  "stripe",
  "github",
  "spotify",
  "notion",
  "netflix",
  "discord",
  "apple",
  "nord",
] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: [string, string, string]; // background, surface, accent
  themeColor: string;
  group: "original" | "inspired";
};

export const THEMES: ThemeMeta[] = [
  {
    id: "classic",
    group: "original",
    name: "Classic Ember",
    tagline: "Original black + ember",
    swatch: ["#000000", "#161616", "#ff6f42"],
    themeColor: "#000000",
  },
  {
    id: "glass",
    group: "original",
    name: "Midnight Glass",
    tagline: "Frosted panels, navy aurora",
    swatch: ["#060a17", "#1b2240", "#ff7a90"],
    themeColor: "#060a17",
  },
  {
    id: "brutal",
    group: "original",
    name: "Neo Brutal",
    tagline: "Bold borders, hard shadows",
    swatch: ["#ffde59", "#ffffff", "#ff4f7b"],
    themeColor: "#ffde59",
  },
  {
    id: "sage",
    group: "original",
    name: "Sage Daylight",
    tagline: "Soft, airy light mode",
    swatch: ["#e9eee8", "#fbfcfa", "#2f8f57"],
    themeColor: "#e9eee8",
  },
  {
    id: "crt",
    group: "original",
    name: "Phosphor CRT",
    tagline: "Amber terminal glow",
    swatch: ["#0b0800", "#1a1200", "#ffb000"],
    themeColor: "#0b0800",
  },
  {
    id: "linear",
    group: "inspired",
    name: "Linear",
    tagline: "Graphite with indigo focus",
    swatch: ["#08090a", "#1c1d21", "#5e6ad2"],
    themeColor: "#08090a",
  },
  {
    id: "vercel",
    group: "inspired",
    name: "Vercel",
    tagline: "Pure black, Geist, monochrome",
    swatch: ["#000000", "#111111", "#ededed"],
    themeColor: "#000000",
  },
  {
    id: "stripe",
    group: "inspired",
    name: "Stripe",
    tagline: "Crisp white, blurple, soft depth",
    swatch: ["#f6f9fc", "#ffffff", "#635bff"],
    themeColor: "#f6f9fc",
  },
  {
    id: "github",
    group: "inspired",
    name: "GitHub Dimmed",
    tagline: "Slate dim mode for long sessions",
    swatch: ["#22272e", "#2d333b", "#f69d50"],
    themeColor: "#22272e",
  },
  {
    id: "spotify",
    group: "inspired",
    name: "Spotify",
    tagline: "Deep black and signature green",
    swatch: ["#121212", "#242424", "#1ed760"],
    themeColor: "#121212",
  },
  {
    id: "notion",
    group: "inspired",
    name: "Notion",
    tagline: "Paper white, quiet ink",
    swatch: ["#f7f7f5", "#ffffff", "#2383e2"],
    themeColor: "#f7f7f5",
  },
  {
    id: "netflix",
    group: "inspired",
    name: "Netflix",
    tagline: "Cinema black, marquee red",
    swatch: ["#000000", "#181818", "#e50914"],
    themeColor: "#000000",
  },
  {
    id: "discord",
    group: "inspired",
    name: "Discord",
    tagline: "Cozy charcoal, blurple pop",
    swatch: ["#313338", "#2b2d31", "#5865f2"],
    themeColor: "#313338",
  },
  {
    id: "apple",
    group: "inspired",
    name: "Apple",
    tagline: "Light gray, calm blue",
    swatch: ["#f5f5f7", "#ffffff", "#0071e3"],
    themeColor: "#f5f5f7",
  },
  {
    id: "nord",
    group: "inspired",
    name: "Nord",
    tagline: "Arctic frost blues",
    swatch: ["#2e3440", "#3b4252", "#88c0d0"],
    themeColor: "#2e3440",
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

  const color = THEMES.find((t) => t.id === theme)?.themeColor ?? "#000000";
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
    // 23514 = the database still has the old 5-theme check constraint; keep the
    // choice on this device until the later-list migration is applied.
    if (error?.code === "23514") {
      console.warn("[supabase] theme not saved remotely — run supabase/migrations/20261122000000_later_list_upgrades.sql");
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
