import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { THEMES, type ThemeId } from "../lib/theme";

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
        <Swatch colors={current.swatch} small />
        theme
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
            className="surface absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-line p-2"
            style={{ backgroundColor: "var(--color-ink)" }}
          >
            <p className="tracked px-2 pb-2 pt-1 text-[9px] text-faint">[ select theme ]</p>
            {THEMES.map((t) => {
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
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors ${
                    on ? "bg-panel-2" : "hover:bg-panel"
                  }`}
                >
                  <Swatch colors={t.swatch} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{t.name}</span>
                    <span className="block truncate text-xs text-muted">{t.tagline}</span>
                  </span>
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-orange" : "border border-line"}`}
                  />
                </button>
              );
            })}
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
      className={`relative shrink-0 overflow-hidden rounded-md border border-line ${small ? "h-3.5 w-3.5" : "h-9 w-9"}`}
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
