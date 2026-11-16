import { useEffect, useState } from "react";

type Props = {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
};

export default function TimeBox({ label, value, max, onChange }: Props) {
  const clamp = (v: number) => Math.max(0, Math.min(max, v));
  // Local string state so the field can be emptied while typing.
  const [draft, setDraft] = useState(String(value));

  // Keep the field in sync when the value changes from outside (chips, steppers).
  useEffect(() => {
    setDraft(value === 0 ? "" : String(value));
  }, [value]);

  return (
    <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 transition-colors focus-within:border-orange">
      <input
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={draft}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          if (raw === "") {
            setDraft("");
            onChange(0);
            return;
          }
          const n = clamp(parseInt(raw, 10));
          setDraft(String(n));
          onChange(n);
        }}
        onBlur={() => setDraft(value === 0 ? "" : String(value))}
        className="display w-full bg-transparent text-3xl leading-none text-fg outline-none tabular-nums placeholder:text-faint"
      />
      <div className="flex flex-col items-center gap-1">
        <span className="tracked text-[9px] text-faint">{label}</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onChange(clamp(value - 1))}
            className="grid h-6 w-6 place-items-center rounded border border-line text-muted transition-colors hover:border-orange hover:text-orange"
          >
            <span className="text-sm leading-none">−</span>
          </button>
          <button
            type="button"
            onClick={() => onChange(clamp(value + 1))}
            className="grid h-6 w-6 place-items-center rounded border border-line text-muted transition-colors hover:border-orange hover:text-orange"
          >
            <span className="text-sm leading-none">+</span>
          </button>
        </div>
      </div>
    </div>
  );
}
