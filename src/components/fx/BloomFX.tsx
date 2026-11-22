// Bloom — a blurred lily photograph behind smoked glass. The camera slowly
// drifts while a second, softer copy breathes in and out like a focus pull.
export default function BloomFX() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <img
        src="/themes/bloom.png"
        alt=""
        className="bloom-base absolute inset-[-6%] h-[112%] w-[112%] object-cover"
      />
      <img
        src="/themes/bloom.png"
        alt=""
        className="bloom-soft absolute inset-[-6%] h-[112%] w-[112%] object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 50% 40%, rgba(20,12,16,0.15), rgba(20,12,16,0.55) 100%)",
        }}
      />
    </div>
  );
}
