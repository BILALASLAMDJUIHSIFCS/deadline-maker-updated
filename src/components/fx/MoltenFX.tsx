import { useEffect, useRef } from "react";

// Molten Switch — a lerped cursor spotlight. The pointer position is written
// to --mx / --my on every .panel-fx card, whose CSS uses it (with
// background-attachment: fixed) to light the glass and ignite each rim.
export default function MoltenFX() {
  const glow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let tx = window.innerWidth * 0.5;
    let ty = window.innerHeight * 0.25;
    let x = tx;
    let y = ty;
    let raf = 0;

    const paint = () => {
      const mx = `${x.toFixed(1)}px`;
      const my = `${y.toFixed(1)}px`;
      document.querySelectorAll<HTMLElement>(".panel-fx").forEach((el) => {
        el.style.setProperty("--mx", mx);
        el.style.setProperty("--my", my);
      });
      if (glow.current) glow.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const loop = () => {
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      paint();
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.4 ? requestAnimationFrame(loop) : 0;
    };

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    paint();
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.querySelectorAll<HTMLElement>(".panel-fx").forEach((el) => {
        el.style.removeProperty("--mx");
        el.style.removeProperty("--my");
      });
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        ref={glow}
        className="absolute -left-[320px] -top-[320px] h-[640px] w-[640px] rounded-full will-change-transform"
        style={{ background: "radial-gradient(circle, rgba(255,106,26,0.14), transparent 62%)" }}
      />
    </div>
  );
}
