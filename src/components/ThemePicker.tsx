import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Moon, Palette, Sparkles, Sun } from "lucide-react";
import { THEMES, type ThemeId, type ThemeMeta } from "../lib/theme";

const GROUPS: { id: ThemeMeta["group"]; label: string }[] = [
  { id: "original", label: "originals" },
  { id: "collection", label: "new collection · 10 kits" },
];

type Props = { value: ThemeId; onChange: (id: ThemeId) => void };

export default function ThemePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = THEMES.find((t) => t.id === value) ?? THEMES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="theme-menu"
        onClick={() => setOpen((v) => !v)}
        className="surface tracked flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-[10px] text-muted transition-colors hover:border-orange hover:text-fg"
      >
        <Palette aria-hidden className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{current.name}</span>
        <span className="sm:hidden">theme</span>
        <Swatch colors={current.swatch} small />
        <ChevronDown aria-hidden className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="theme-menu"
            role="radiogroup"
            aria-label="Choose theme"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="surface absolute right-0 z-50 mt-2 max-h-[70vh] w-[27rem] overflow-y-auto rounded-xl border border-line p-2 max-sm:fixed max-sm:inset-x-4 max-sm:top-24 max-sm:mt-0 max-sm:w-auto"
            style={{ backgroundColor: "var(--color-ink)" }}
          >
            {GROUPS.map((g) => (
              <div key={g.id} className="pb-1">
                <p className="tracked px-2 pb-1.5 pt-2 text-[9px] text-faint">[ {g.label} ]</p>
                <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                  {THEMES.filter((t) => t.group === g.id).map((t) => {
                    const on = t.id === value;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          onChange(t.id);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                          on ? "bg-panel-2" : "hover:bg-panel"
                        }`}
                      >
                        <Swatch colors={t.swatch} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-semibold text-fg">{t.name}</span>
                            {t.mode === "light" ? (
                              <Sun aria-label="light theme" className="h-3 w-3 shrink-0 text-faint" />
                            ) : (
                              <Moon aria-label="dark theme" className="h-3 w-3 shrink-0 text-faint" />
                            )}
                          </span>
                          <span className="block truncate text-[11px] text-muted">{t.tagline}</span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-faint">
                            <Sparkles aria-hidden className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{t.motion}</span>
                          </span>
                          {t.engine && (
                            <span className="tracked mt-1 inline-block rounded border border-orange/40 px-1 py-px text-[7px] text-orange">
                              {t.engine}
                            </span>
                          )}
                        </span>
                        {on && <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-orange" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Swatch({ colors, small }: { colors: [string, string, string]; small?: boolean }) {
  const [bg, surface, accent] = colors;
  return (
    <span
      aria-hidden
      className={`relative shrink-0 overflow-hidden rounded-md border border-line ${small ? "h-3.5 w-3.5" : "h-8 w-8"}`}
      style={{ backgroundColor: bg }}
    >
      <span
        className="absolute bottom-0 right-0 h-2/3 w-2/3 rounded-tl-md"
        style={{ backgroundColor: surface }}
      />
      <span
        className={`absolute rounded-full ${small ? "bottom-0.5 right-0.5 h-1 w-1" : "bottom-1.5 right-1.5 h-2.5 w-2.5"}`}
        style={{ backgroundColor: accent }}
      />
    </span>
  );
}
