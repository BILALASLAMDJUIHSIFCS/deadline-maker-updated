import type { CSSProperties } from "react";
import { Sparkle } from "lucide-react";
import type { ThemeId } from "../../lib/theme";

// Theme decorations that sit around the deadline composer card.
export default function ComposerDecor({ theme }: { theme: ThemeId }) {
  if (theme === "citrus") return <CitrusDeck />;
  if (theme === "honey") return <HoneySparkles />;
  return null;
}

const DECK = [
  { top: "−25 MIN", sub: "focus block", r: -16, x: -150 },
  { top: "+1H 30M", sub: "deep work", r: -7, x: -76 },
  { top: "→ 45m", sub: "later list", r: 0, x: 0 },
  { top: "3 CYCLES", sub: "today", r: 8, x: 76 },
  { top: "10:42 PM", sub: "fires at", r: 16, x: 150 },
];

// Citrus Frost — receipt cards peeking above the glass; they fan out when the
// composer is hovered or focused.
function CitrusDeck() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-14 flex h-24 justify-center">
      {DECK.map((c, i) => (
        <div
          key={c.top}
          className="citrus-card absolute top-0"
          style={{ "--r": `${c.r}deg`, "--x": `${c.x}px` } as CSSProperties}
        >
          <div
            className="citrus-card-inner flex h-24 w-32 flex-col gap-1 rounded-2xl border border-line bg-panel-2 px-3 py-2.5 backdrop-blur-xl"
            style={{ animationDelay: `${i * -0.9}s`, boxShadow: "0 10px 24px -12px rgba(30,50,20,0.45)" }}
          >
            <span className="font-sans text-[13px] font-bold tabular-nums text-fg">{c.top}</span>
            <span className="tracked text-[7px] text-faint">{c.sub}</span>
            <span className="mt-1 h-1 w-16 rounded-full bg-[color:var(--color-bar-off)]" />
            <span className="h-1 w-10 rounded-full bg-[color:var(--color-bar-off)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

const SPARKS = [
  { cls: "-left-2 -top-3 h-6 w-6", d: "0s" },
  { cls: "-right-3 top-16 h-4 w-4", d: "-1.1s" },
  { cls: "bottom-10 -left-3 h-4 w-4", d: "-2s" },
  { cls: "-bottom-3 right-20 h-5 w-5", d: "-0.6s" },
];

// Honey Task — four-point sparkles twinkling at the card's corners.
function HoneySparkles() {
  return (
    <>
      {SPARKS.map((s) => (
        <Sparkle
          key={s.cls}
          aria-hidden
          className={`honey-spark pointer-events-none absolute z-10 fill-current text-orange ${s.cls}`}
          style={{ animationDelay: s.d }}
          strokeWidth={0}
        />
      ))}
    </>
  );
}
