// Pause-aware time math for deadlines.
//
// A task's `deadline` is pushed back by every pause once it is resumed, and the
// total paused time is kept in `pausedMs`. That keeps `deadline` the true wall
// clock fire time for notifications, while the "real" set duration is always
// `deadline - createdAt - pausedMs`.

import type { Task } from "./storage";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const isPaused = (t: Task) => t.status === "active" && t.pausedAt != null;

/** The duration the deadline was set for, with pauses removed. */
export function durationMs(t: Task): number {
  return Math.max(0, t.deadline - t.createdAt - (t.pausedMs ?? 0));
}

/** Time actually spent on the clock (pauses excluded). */
export function elapsedMs(t: Task, now: number): number {
  const end =
    t.status === "active"
      ? Math.min(now, t.pausedAt ?? now)
      : Math.min(t.resolvedAt ?? t.deadline, t.deadline);
  return clamp(end - t.createdAt - (t.pausedMs ?? 0), 0, durationMs(t));
}

export function remainingMs(t: Task, now: number): number {
  if (t.status !== "active") return 0;
  return Math.max(0, durationMs(t) - elapsedMs(t, now));
}

export function progressOf(t: Task, now: number): number {
  const d = durationMs(t);
  return d > 0 ? elapsedMs(t, now) / d : 1;
}

export function pauseTask(t: Task, now: number): Task {
  if (t.status !== "active" || t.pausedAt != null) return t;
  return { ...t, pausedAt: now, updatedAt: now };
}

export function resumeTask(t: Task, now: number): Task {
  if (t.pausedAt == null) return t;
  const gap = Math.max(0, now - t.pausedAt);
  return {
    ...t,
    deadline: t.deadline + gap,
    pausedMs: (t.pausedMs ?? 0) + gap,
    pausedAt: null,
    updatedAt: now,
  };
}
