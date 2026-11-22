import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Legend } from "./WeekChart";
import { dayKey, lastSevenDays, type Task } from "../lib/storage";
import { CYCLE_MIN, DAILY_CYCLES, cyclesForDay, fmtHM } from "../lib/cycles";
import { loadLocalSnapshots, pullAndMergeSnapshots, type DailySnapshot } from "../lib/history";

type DayStat = { done: number; missed: number; cycles: number; focusMin: number };

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const pad = (n: number) => String(n).padStart(2, "0");
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
}

function monthLabel(key: string, style: "long" | "short" = "long"): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], {
    month: style,
    year: style === "long" ? "numeric" : "2-digit",
  });
}

const rateOf = (s: { done: number; missed: number }) =>
  s.done + s.missed ? Math.round((s.done / (s.done + s.missed)) * 100) : null;

export default function MonthView({ tasks }: { tasks: Task[] }) {
  const todayKey = dayKey(Date.now());
  const currentMonth = todayKey.slice(0, 7);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>(() => loadLocalSnapshots());
  const [month, setMonth] = useState(currentMonth);
  const [picked, setPicked] = useState<string>(todayKey);

  useEffect(() => {
    void pullAndMergeSnapshots().then(setSnapshots);
  }, []);

  // Snapshots are the long-term record; the live task list is more precise
  // for the rolling week it still holds.
  const byDay = useMemo(() => {
    const map = new Map<string, DayStat>();
    for (const s of snapshots) {
      map.set(s.day, {
        done: s.tasksCompleted,
        missed: s.tasksMissed,
        cycles: s.cyclesCompleted,
        focusMin: s.totalDoneMin,
      });
    }
    for (const d of lastSevenDays()) {
      const c = cyclesForDay(tasks, d);
      if (!c.doneCount && !c.missedCount) continue;
      map.set(d, {
        done: c.doneCount,
        missed: c.missedCount,
        cycles: Math.floor(c.doneMin / CYCLE_MIN),
        focusMin: c.doneMin,
      });
    }
    return map;
  }, [snapshots, tasks]);

  const earliest = useMemo(() => {
    const keys = [...byDay.keys()].sort();
    const fiveBack = shiftMonth(currentMonth, -5);
    return keys.length && keys[0].slice(0, 7) < fiveBack ? keys[0].slice(0, 7) : fiveBack;
  }, [byDay, currentMonth]);

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leading = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first
  const days = Array.from({ length: daysInMonth }, (_, i) => `${month}-${pad(i + 1)}`);

  const totals = days.reduce(
    (a, d) => {
      const s = byDay.get(d);
      if (!s) return a;
      return {
        done: a.done + s.done,
        missed: a.missed + s.missed,
        cycles: a.cycles + s.cycles,
        focusMin: a.focusMin + s.focusMin,
        active: a.active + 1,
      };
    },
    { done: 0, missed: 0, cycles: 0, focusMin: 0, active: 0 }
  );
  const rate = rateOf(totals) ?? 0;
  const maxDone = Math.max(1, ...days.map((d) => byDay.get(d)?.done ?? 0));
  const isCurrent = month === currentMonth;
  const dayOfMonth = Number(todayKey.slice(8));
  const elapsedDays = isCurrent ? dayOfMonth : daysInMonth;

  const trend = useMemo(() => {
    const out: { key: string; done: number; missed: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const key = shiftMonth(currentMonth, -i);
      let done = 0;
      let missed = 0;
      for (const [d, s] of byDay) {
        if (!d.startsWith(key)) continue;
        done += s.done;
        missed += s.missed;
      }
      out.push({ key, done, missed });
    }
    return out;
  }, [byDay, currentMonth]);
  const trendMax = Math.max(1, ...trend.map((t) => t.done + t.missed));

  const pickedStat = byDay.get(picked);
  const pickedInMonth = picked.startsWith(month);

  function go(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setPicked(next === currentMonth ? todayKey : `${next}-01`);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={month <= earliest}
          aria-label="Previous month"
          className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted transition-colors hover:border-orange hover:text-orange disabled:opacity-30 disabled:hover:border-line disabled:hover:text-muted"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center">
          <p className="font-mono text-sm font-semibold text-fg">{monthLabel(month)}</p>
          <p className="tracked mt-0.5 text-[8px] text-faint">
            {isCurrent ? `day ${dayOfMonth} of ${daysInMonth}` : `${totals.active} active days`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={isCurrent}
          aria-label="Next month"
          className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted transition-colors hover:border-orange hover:text-orange disabled:opacity-30 disabled:hover:border-line disabled:hover:text-muted"
        >
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          <span className="display text-5xl leading-none text-fg tabular-nums">{rate}</span>
          <span className="display text-xl text-muted">%</span>
        </div>
        <div className="flex gap-4 text-right">
          <Mini n={totals.done} label="done" tone="text-lime" />
          <Mini n={totals.missed} label="missed" tone="text-miss" />
          <Mini n={totals.cycles} label="cycles" tone="text-cyan" />
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--color-bar-off)" }}>
        <motion.div
          className="h-full rounded-full bg-orange"
          initial={{ width: 0 }}
          animate={{ width: `${(elapsedDays / daysInMonth) * 100}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 26 }}
        />
      </div>
      <div className="mt-1 flex justify-between tracked text-[8px] text-faint">
        <span>{fmtHM(totals.focusMin)} focused</span>
        <span>
          {isCurrent ? `${daysInMonth - dayOfMonth} days left` : `${totals.active}/${daysInMonth} days tracked`}
        </span>
      </div>

      {/* Calendar heatmap */}
      <div className="mt-5 grid grid-cols-7 gap-1.5" role="group" aria-label={`${monthLabel(month)} calendar`}>
        {WEEKDAYS.map((w) => (
          <span key={w} aria-hidden className="tracked pb-1 text-center text-[8px] text-faint">
            {w}
          </span>
        ))}
        {Array.from({ length: leading }).map((_, i) => (
          <span key={`b${i}`} aria-hidden />
        ))}
        {days.map((d, i) => {
          const s = byDay.get(d);
          const future = d > todayKey;
          const isToday = d === todayKey;
          const isPicked = d === picked;
          const missHeavy = !!s && s.missed > s.done;
          const strength = s ? 18 + Math.round((Math.max(s.done, s.missed) / maxDone) * 70) : 0;
          const fill = s
            ? `color-mix(in srgb, var(--color-${missHeavy ? "miss" : "lime"}) ${Math.min(88, strength)}%, transparent)`
            : undefined;
          return (
            <motion.button
              key={d}
              type="button"
              aria-pressed={isPicked}
              disabled={future}
              onClick={() => setPicked(d)}
              onPointerEnter={() => !future && setPicked(d)}
              aria-label={`${new Date(d + "T00:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}: ${
                s ? `${s.done} completed, ${s.missed} missed` : "no activity"
              }`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.008, duration: 0.2 }}
              className={`relative aspect-square rounded-md border text-[10px] font-mono tabular-nums outline-none transition-colors focus-visible:ring-1 focus-visible:ring-orange ${
                future ? "border-dashed border-line-soft text-faint/60" : "border-line-soft text-muted"
              } ${isPicked ? "ring-1 ring-fg" : ""} ${isToday ? "border-orange text-orange" : ""}`}
              style={{ backgroundColor: fill ?? (future ? "transparent" : "var(--color-bar-off)") }}
            >
              <span className={`absolute left-1 top-0.5 ${s && strength > 55 ? "text-fg" : ""}`}>{i + 1}</span>
              {s && s.missed > 0 && !missHeavy && (
                <span aria-hidden className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-miss" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Picked day */}
      <div className="mt-3 rounded-lg border border-line-soft bg-panel-2 px-3 py-2.5" aria-live="polite">
        {pickedInMonth ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
            <span className="font-semibold text-fg">
              {new Date(picked + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            </span>
            {pickedStat ? (
              <>
                <span className="text-lime">{pickedStat.done} done</span>
                <span className="text-miss">{pickedStat.missed} missed</span>
                <span className="text-cyan">
                  {pickedStat.cycles}/{DAILY_CYCLES} cyc
                </span>
                <span className="text-muted">{fmtHM(pickedStat.focusMin)}</span>
              </>
            ) : (
              <span className="text-faint">no activity recorded</span>
            )}
          </div>
        ) : (
          <span className="font-mono text-[11px] text-faint">Hover or tap a day for details</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 tracked text-[9px] text-muted">
        <Legend color="bg-lime" text="mostly done" />
        <Legend color="bg-miss" text="mostly missed" />
        <span className="ml-auto flex items-center gap-1">
          less
          {[20, 45, 70, 88].map((p) => (
            <span
              key={p}
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: `color-mix(in srgb, var(--color-lime) ${p}%, transparent)` }}
            />
          ))}
          more
        </span>
      </div>

      {/* 6-month overview */}
      <div className="mt-6 border-t border-line-soft pt-4">
        <span className="tracked text-[9px] text-faint">last 6 months</span>
        <div className="mt-3 flex items-end gap-2" style={{ height: 72 }}>
          {trend.map((t) => {
            const total = t.done + t.missed;
            const h = total ? Math.max(6, (total / trendMax) * 56) : 3;
            const on = t.key === month;
            const r = rateOf(t);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setMonth(t.key);
                  setPicked(t.key === currentMonth ? todayKey : `${t.key}-01`);
                }}
                aria-label={`${monthLabel(t.key)}: ${t.done} completed, ${t.missed} missed`}
                aria-pressed={on}
                className="group flex flex-1 flex-col items-center gap-1.5 outline-none"
              >
                <span className={`tracked text-[8px] tabular-nums ${on ? "text-fg" : "text-faint"}`}>
                  {r === null ? "–" : `${r}%`}
                </span>
                <span
                  className={`flex w-full flex-col-reverse overflow-hidden rounded-[3px] transition-opacity group-focus-visible:ring-1 group-focus-visible:ring-orange ${
                    on ? "" : "opacity-50 group-hover:opacity-80"
                  }`}
                  style={{ height: h, backgroundColor: total ? undefined : "var(--color-bar-off)" }}
                >
                  {t.done > 0 && <span style={{ flexGrow: t.done }} className="block w-full bg-lime" />}
                  {t.missed > 0 && <span style={{ flexGrow: t.missed }} className="block w-full bg-miss" />}
                </span>
                <span className={`tracked text-[8px] ${on ? "text-orange" : "text-faint"}`}>
                  {monthLabel(t.key, "short").split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-5 border-t border-line-soft pt-4 font-mono text-[10px] leading-relaxed text-faint">
        Each day is saved automatically and synced with Supabase. {DAILY_CYCLES} cycles/day target ({CYCLE_MIN}m each).
      </p>
    </div>
  );
}

function Mini({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div>
      <div className={`display text-2xl leading-none tabular-nums ${tone}`}>{n}</div>
      <div className="tracked mt-1 text-[8px] text-faint">{label}</div>
    </div>
  );
}
