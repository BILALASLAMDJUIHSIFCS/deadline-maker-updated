import { Pause, Play } from "lucide-react";
import { Switch } from "./ui/switch";

type Props = {
  paused: boolean;
  onToggle: () => void;
  size?: "sm" | "lg";
  className?: string;
};

// Pause / resume a live deadline. Built on the shadcn Switch: "on" = paused.
export default function PauseSwitch({ paused, onToggle, size = "sm", className }: Props) {
  const icon = size === "lg" ? "h-5 w-5" : "h-3 w-3";
  return (
    <Switch
      size={size}
      checked={paused}
      onCheckedChange={onToggle}
      aria-label={paused ? "Resume timer" : "Pause timer"}
      title={paused ? "Resume timer" : "Pause timer"}
      onLabel="paused"
      offLabel="live"
      className={className}
      thumb={
        paused ? (
          <Play aria-hidden className={`${icon} fill-current text-fg`} />
        ) : (
          <Pause aria-hidden className={`${icon} fill-current text-fg`} />
        )
      }
    />
  );
}
