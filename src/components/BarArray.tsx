type Props = {
  progress: number; // 0..1 filled
  count?: number;
  tone?: "orange" | "miss" | "amber" | "lime" | "cyan" | "muted";
  className?: string;
};

const TONE: Record<string, string> = {
  orange: "var(--color-orange)",
  miss: "var(--color-miss)",
  amber: "var(--color-amber)",
  lime: "var(--color-lime)",
  cyan: "var(--color-cyan)",
  muted: "var(--color-muted)",
};

// Vertical bar strip — the signature array motif from the reference system.
export default function BarArray({ progress, count = 34, tone = "orange", className }: Props) {
  const filled = Math.max(0, Math.min(count, Math.round(progress * count)));
  return (
    <div className={`flex items-stretch gap-[3px] ${className ?? ""}`}>
      {Array.from({ length: count }).map((_, i) => {
        const on = i < filled;
        const edge = i === filled - 1;
        return (
          <div
            key={i}
            className="flex-1 rounded-[1px] transition-colors duration-300"
            style={{
              backgroundColor: on ? TONE[tone] : "var(--color-bar-off)",
              opacity: on ? (edge ? 1 : 0.85) : 1,
            }}
          />
        );
      })}
    </div>
  );
}
