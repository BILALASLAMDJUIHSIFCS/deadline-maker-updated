import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../../lib/utils";

// shadcn/ui Switch (Radix primitive), re-skinned after the "molten glass"
// toggle reference: a recessed pill track, a wide frosted-glass thumb with a
// dotted grip, and the accent colour bleeding out from under the glass when on.
type Props = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "lg";
  onLabel?: React.ReactNode;
  offLabel?: React.ReactNode;
  thumb?: React.ReactNode;
};

const SIZES = {
  sm: {
    root: "h-7 w-[100px]",
    thumb: "h-6 w-[44px] data-[state=checked]:translate-x-[52px]",
    label: "text-[8px]",
  },
  lg: {
    root: "h-14 w-[188px]",
    thumb: "h-12 w-[92px] data-[state=checked]:translate-x-[88px]",
    label: "text-[11px]",
  },
} as const;

function Switch({ className, size = "sm", onLabel, offLabel, thumb, checked, ...props }: Props) {
  const s = SIZES[size];
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={checked}
      className={cn(
        "molten-switch group/switch relative inline-flex shrink-0 items-center rounded-full border border-line p-[2px] outline-none transition-colors duration-300",
        "bg-panel-2 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]",
        "focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-ink)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        s.root,
        className
      )}
      {...props}
    >
      {/* molten bleed: the accent glows out from under the glass when on */}
      <span
        aria-hidden
        className="molten-bleed pointer-events-none absolute inset-y-[3px] left-[3px] right-[3px] rounded-full opacity-0 transition-opacity duration-500 group-data-[state=checked]/switch:opacity-100"
      />
      <span
        aria-hidden
        className={cn(
          "tracked pointer-events-none absolute inset-y-0 flex items-center font-semibold transition-all duration-300",
          s.label,
          checked ? "left-0 right-[52%] justify-center text-[color:var(--color-orange-ink)]" : "left-[50%] right-0 justify-center text-muted"
        )}
      >
        {checked ? onLabel : offLabel}
      </span>
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "molten-thumb pointer-events-none relative z-10 grid place-items-center rounded-full transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] data-[state=unchecked]:translate-x-0",
          s.thumb
        )}
      >
        {thumb}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
