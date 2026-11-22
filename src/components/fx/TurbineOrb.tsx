import { useEffect, useRef, type CSSProperties } from "react";

type Props = {
  /** 0..1 — how far the nearest running deadline has burned down. */
  progress: number;
  /** Whether any deadline is currently running. */
  running: boolean;
};

// Turbine — a purifier-style fan orb. Blade speed eases toward a target that
// rises with urgency, and the colour shifts mint → amber → ember near the end.
export default function TurbineOrb({ progress, running }: Props) {
  const blades = useRef<HTMLDivElement>(null);
  const target = useRef(0.1);
  target.current = running ? 0.25 + progress * progress * 2.8 : 0.08;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let speed = target.current;
    let angle = 0;
    let lastT = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      speed += (target.current - speed) * 0.025;
      angle = (angle + speed * 360 * dt) % 360;
      if (blades.current) blades.current.style.transform = `rotate(${angle}deg)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const tone = !running ? "#5ef2c2" : progress < 0.6 ? "#5ef2c2" : progress < 0.85 ? "#ffb547" : "#ff6a3d";
  const pct = Math.round((running ? progress : 0) * 100);
  const C = 2 * Math.PI * 22;

  return (
    <div
      role="img"
      aria-label={running ? `Nearest deadline ${pct}% elapsed` : "No deadline running"}
      className="relative grid h-14 w-14 shrink-0 place-items-center"
      style={{ "--orb": tone } as CSSProperties}
    >
      <span
        aria-hidden
        className="absolute -bottom-2 left-1/2 h-4 w-12 -translate-x-1/2 rounded-full blur-md transition-colors duration-700"
        style={{ background: "#56d8ff", opacity: 0.45 }}
      />
      <svg aria-hidden viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
        <circle
          cx="24"
          cy="24"
          r="22"
          fill="none"
          stroke={tone}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${(C * pct) / 100} ${C}`}
          style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.7s ease", filter: `drop-shadow(0 0 3px ${tone})` }}
        />
      </svg>
      <div
        aria-hidden
        className="relative h-10 w-10 overflow-hidden rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 35%, #2c2d31, #121315 75%)",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.7), inset 0 -1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div
          ref={blades}
          className="absolute inset-0 will-change-transform"
          style={{
            background: "repeating-conic-gradient(from 0deg, var(--orb) 0deg 24deg, transparent 30deg 72deg)",
            filter: "blur(2.5px)",
            opacity: 0.85,
            WebkitMaskImage: "radial-gradient(circle, transparent 16%, #000 30%, #000 58%, transparent 74%)",
            maskImage: "radial-gradient(circle, transparent 16%, #000 30%, #000 58%, transparent 74%)",
            transition: "background 0.7s ease",
          }}
        />
        <span
          className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "#f1f2f3", boxShadow: "0 0 8px rgba(255,255,255,0.6)" }}
        />
      </div>
    </div>
  );
}
