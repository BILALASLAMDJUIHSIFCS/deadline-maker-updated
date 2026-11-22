import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// Pixel Dial — a 60-segment seconds dial driven by GSAP. It "boots" with an
// elastic stagger, then each second the next segment flashes in; at the top of
// the minute the whole ring drains back in reverse.

const TICKS = 60;
const ON = "#9b6bff";
const OFF = "rgba(155, 107, 255, 0.13)";
const R_OUT = 182;
const TICK_H = 30;

export default function PixelDialFX() {
  const svgRef = useRef<SVGSVGElement>(null);
  const labelRef = useRef<SVGTextElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ticks = Array.from(svg.querySelectorAll<SVGRectElement>(".dial-tick"));
    let last = new Date().getSeconds();
    let interval = 0;

    const ctx = gsap.context(() => {
      gsap.set(ticks, { fill: OFF });
      if (labelRef.current) labelRef.current.textContent = String(last).padStart(2, "0");

      if (reduce) {
        gsap.set(ticks.slice(0, last + 1), { fill: ON });
      } else {
        gsap
          .timeline()
          .from(ticks, {
            scaleY: 0,
            opacity: 0,
            transformOrigin: "50% 100%",
            duration: 0.7,
            ease: "back.out(3)",
            stagger: { each: 0.012, from: "start" },
          })
          .to(ticks.slice(0, last + 1), { fill: ON, duration: 0.3, stagger: 0.012 }, "-=0.4")
          .from(".dial-ring", { opacity: 0, scale: 0.85, svgOrigin: "200 200", duration: 1.1, ease: "expo.out" }, 0);
        gsap.to(".dial-orbit", { rotation: 360, svgOrigin: "200 200", duration: 60, ease: "none", repeat: -1 });
      }

      const step = () => {
        const s = new Date().getSeconds();
        if (s === last) return;
        if (labelRef.current) labelRef.current.textContent = String(s).padStart(2, "0");
        if (s < last) {
          // new minute: drain the ring, then light the first segment
          if (reduce) {
            gsap.set(ticks, { fill: OFF });
            gsap.set(ticks.slice(0, s + 1), { fill: ON });
          } else {
            gsap.to(ticks, { fill: OFF, duration: 0.35, stagger: { each: 0.006, from: "end" } });
            gsap.to(ticks.slice(0, s + 1), { fill: ON, duration: 0.3, delay: 0.5 });
          }
        } else {
          // catch up on any skipped seconds (background-tab throttling)
          gsap.set(ticks.slice(last + 1, s), { fill: ON });
          if (reduce) gsap.set(ticks[s], { fill: ON });
          else
            gsap.fromTo(
              ticks[s],
              { fill: "#ffffff", scaleY: 1.35, transformOrigin: "50% 100%" },
              { fill: ON, scaleY: 1, duration: 0.6, ease: "power3.out" }
            );
        }
        last = s;
      };
      interval = window.setInterval(step, 250);
    }, svg);

    return () => {
      window.clearInterval(interval);
      ctx.revert();
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed -right-36 -top-28 w-[380px] opacity-40 lg:-right-40 lg:top-1/2 lg:w-[640px] lg:-translate-y-1/2 lg:opacity-55"
    >
      <svg
        ref={svgRef}
        viewBox="0 0 400 400"
        className="h-auto w-full"
        style={{ filter: "drop-shadow(0 0 24px rgba(155, 107, 255, 0.45))" }}
      >
        <g className="dial-ring">
          <circle cx="200" cy="200" r="140" fill="none" stroke="rgba(155,107,255,0.16)" strokeWidth="1" />
          <circle cx="200" cy="200" r="198" fill="none" stroke="rgba(155,107,255,0.08)" strokeWidth="1" />
        </g>
        <circle
          className="dial-orbit"
          cx="200"
          cy="200"
          r="126"
          fill="none"
          stroke="rgba(201,187,255,0.35)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="0.1 9"
        />
        {Array.from({ length: TICKS }).map((_, i) => (
          <g key={i} transform={`rotate(${i * 6} 200 200)`}>
            <rect
              className="dial-tick"
              x="195.5"
              y={200 - R_OUT}
              width="9"
              height={TICK_H}
              rx="4.5"
              fill={OFF}
            />
          </g>
        ))}
        <text
          ref={labelRef}
          x="200"
          y="222"
          textAnchor="middle"
          fontFamily="Doto, monospace"
          fontWeight="800"
          fontSize="76"
          fill="rgba(243,239,255,0.9)"
        >
          00
        </text>
        <text
          x="200"
          y="252"
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="10"
          letterSpacing="3"
          fill="rgba(171,161,198,0.8)"
        >
          SEC
        </text>
      </svg>
    </div>
  );
}
