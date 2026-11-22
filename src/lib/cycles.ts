import { dayKey, lastSevenDays, type Task } from "./storage";
import { durationMs } from "./taskTime";

// The daily quota: 16h 30m of work, measured in 30-minute cycles → 33 cycles.
export const CYCLE_MIN = 30;
export const DAILY_TARGET_MIN = 16 * 60 + 30;
export const DAILY_CYCLES = DAILY_TARGET_MIN / CYCLE_MIN;

// A todo is worth the duration it was set for (e.g. a 50m todo = 1⅔ cycles).
export const taskMinutes = (t: Task) => Math.max(0, Math.round(durationMs(t) / 60_000));

// Resolved tasks count toward the day they were finished/missed; live ones
// toward the day they were created.
const countedDay = (t: Task) => (t.status === "active" ? t.day : dayKey(t.resolvedAt ?? t.deadline));

export type DayCycles = {
  day: string;
  doneMin: number;
  missedMin: number;
  liveMin: number;
  doneCount: number;
  missedCount: number;
};

export function cyclesForDay(tasks: Task[], day: string): DayCycles {
  const out: DayCycles = { day, doneMin: 0, missedMin: 0, liveMin: 0, doneCount: 0, missedCount: 0 };
  for (const t of tasks) {
    if (countedDay(t) !== day) continue;
    const m = taskMinutes(t);
    if (t.status === "done") {
      out.doneMin += m;
      out.doneCount++;
    } else if (t.status === "missed") {
      out.missedMin += m;
      out.missedCount++;
    } else {
      out.liveMin += m;
    }
  }
  return out;
}

export function weekCycles(tasks: Task[]): DayCycles[] {
  return lastSevenDays().map((d) => cyclesForDay(tasks, d));
}

export function fmtHM(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (!h) return `${min}m`;
  return min ? `${h}h ${min}m` : `${h}h`;
}

// 1.666… → "1.7", 2 → "2"
export function fmtCycles(min: number): string {
  const c = min / CYCLE_MIN;
  return Number.isInteger(c) ? String(c) : c.toFixed(1);
}
