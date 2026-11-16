// Soft light bleeding from opposite corners. Tinted by the active theme's
// accent and scaled by --glow-strength (0 hides it on the light themes).
export default function CornerGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl"
      style={{ opacity: "var(--glow-strength)" }}
    >
      <div
        className="absolute -left-24 -top-24 h-56 w-56 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-orange) 30%, transparent), transparent 68%)",
        }}
      />
      <div
        className="absolute -bottom-24 -right-24 h-56 w-56 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-orange) 16%, transparent), transparent 70%)",
        }}
      />
      {/* faint hairline sheen along the top edge */}
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-orange/40 to-transparent" />
    </div>
  );
}
