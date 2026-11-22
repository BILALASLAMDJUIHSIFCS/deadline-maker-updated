// Later-list items can carry a time budget after an arrow, e.g.
//   "Write report → 1h 30m"   "Fix bug -> 45m"   "Deep work => 2h"
// The budget is kept inside the text itself so it syncs with no schema change.

const ARROW = String.raw`(?:→|->|=>|⟶|➜|➔|—>|–>)`;
const DURATION = String.raw`(?:\d+(?:\.\d+)?\s*(?:days?|d|hours?|hrs?|h|minutes?|mins?|m)\s*)+`;
const TIME_SUFFIX = new RegExp(String.raw`\s*${ARROW}\s*(${DURATION})\s*$`, "i");
const PART = /(\d+(?:\.\d+)?)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m)/gi;

function unitToMinutes(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("d")) return 1440;
  if (u.startsWith("h")) return 60;
  return 1;
}

export type ParsedTodo = { title: string; minutes: number | null };

export function parseTodoText(text: string): ParsedTodo {
  const match = text.match(TIME_SUFFIX);
  if (!match) return { title: text.trim(), minutes: null };
  let total = 0;
  for (const [, n, unit] of match[1].matchAll(PART)) total += Number(n) * unitToMinutes(unit);
  const minutes = Math.round(total);
  const title = text.slice(0, match.index).trim();
  if (!title || minutes <= 0) return { title: title || text.trim(), minutes: null };
  return { title, minutes };
}

// 63 → "1h 3m", 45 → "45m", 120 → "2h"
export function formatBudget(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (!h) return `${min}m`;
  return min ? `${h}h ${min}m` : `${h}h`;
}

export function withBudget(title: string, minutes: number | null): string {
  return minutes && minutes > 0 ? `${title} → ${formatBudget(minutes)}` : title;
}
