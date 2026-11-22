import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Flag } from "lucide-react";
import { TAGS, type Tag } from "../lib/todos";

export const TAG_META: Record<
  Tag,
  { label: string; hint: string; text: string; chip: string; dot: string; ring: string }
> = {
  high: {
    label: "High",
    hint: "Urgent — do it first",
    text: "text-tag-high",
    chip: "border-tag-high/40 bg-tag-high/15 text-tag-high",
    dot: "bg-tag-high",
    ring: "ring-tag-high",
  },
  medium: {
    label: "Medium",
    hint: "Important, not urgent",
    text: "text-tag-med",
    chip: "border-tag-med/40 bg-tag-med/15 text-tag-med",
    dot: "bg-tag-med",
    ring: "ring-tag-med",
  },
  low: {
    label: "Low",
    hint: "Whenever there's time",
    text: "text-tag-low",
    chip: "border-tag-low/40 bg-tag-low/15 text-tag-low",
    dot: "bg-tag-low",
    ring: "ring-tag-low",
  },
};

export function TagChip({ tag }: { tag: Tag }) {
  const m = TAG_META[tag];
  return (
    <span
      className={`tracked inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[8px] leading-none ${m.chip}`}
    >
      <Flag aria-hidden className="h-2.5 w-2.5" strokeWidth={2.5} />
      {m.label}
    </span>
  );
}

type Props = {
  value: Tag | null | undefined;
  onChange: (tag: Tag | null) => void;
  className?: string;
};

// Small popover for (re)tagging an existing item.
export default function TagPicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  const pick = (tag: Tag | null) => {
    onChange(tag);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={`relative ${open ? "z-30" : ""} ${className ?? ""}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={value ? `Priority: ${TAG_META[value].label}. Change tag` : "Add priority tag"}
        title="Priority tag"
        onClick={() => setOpen((v) => !v)}
        className={`grid h-7 w-7 place-items-center rounded transition-colors hover:bg-panel-2 ${
          value ? TAG_META[value].text : "text-muted hover:text-fg"
        }`}
      >
        <Flag aria-hidden className="h-3.5 w-3.5" fill={value ? "currentColor" : "none"} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 460, damping: 32 }}
            className="surface absolute right-0 top-full mt-1 w-52 rounded-lg border border-line p-1"
            style={{ backgroundColor: "var(--color-ink)" }}
          >
            {TAGS.map((tag) => {
              const m = TAG_META[tag];
              const on = value === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => pick(tag)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors ${
                    on ? "bg-panel-2" : "hover:bg-panel-2"
                  }`}
                >
                  <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.dot}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block font-mono text-xs font-semibold ${m.text}`}>{m.label}</span>
                    <span className="block truncate text-[11px] text-muted">{m.hint}</span>
                  </span>
                  {on && <Check aria-hidden className={`h-3.5 w-3.5 ${m.text}`} />}
                </button>
              );
            })}
            {value && (
              <button
                type="button"
                role="menuitem"
                onClick={() => pick(null)}
                className="tracked mt-1 w-full rounded-md border-t border-line-soft px-2 py-2 text-left text-[9px] text-muted transition-colors hover:text-fg"
              >
                Remove tag
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
