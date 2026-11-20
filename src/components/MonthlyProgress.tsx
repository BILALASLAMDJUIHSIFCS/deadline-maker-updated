import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import CornerGlow from "./CornerGlow";
import { DAILY_CYCLES, CYCLE_MIN } from "../lib/cycles";
import {
  aggregateByMonth,
  getLocalMonthlyHistory,
  pullAndMergeSnapshots,
  type MonthSummary,
  type DailySnapshot,
} from "../lib/history";

type View = "current" | "previous";

/* ── Date helpers ───────────────────────────────────────────────────── */

/** All days from the 1st of the month up to and including `today`. */
function currentMonthDays(): string[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const today = now.getDate();
  const out: string[] = [];
  for (let d = 1; d <= today; d++) {
    out.push(
      `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }
  return out;
}

/** How many days the current month has in total (28-31). */
function daysInCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

/** "November 2026" style header. */
function currentMonthLabel(): string {
  return new Date().toLocaleDateString([], { month: "long", year: "numeric" });
}

/** Current month key like "2026-11". */
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function loadLocalSnapshots(): DailySnapshot[] {
  try {
    const raw = localStorage.getItem("deadline-maker:snapshots:v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   MonthlyProgress — main exported component
   ═══════════════════════════════════════════════════════════════════════ */

export default function MonthlyProgress() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("current");
  const [months, setMonths] = useState<MonthSummary[]>(() =>
    getLocalMonthlyHistory()
  );
  const [allSnapshots, setAllSnapshots] = useState<DailySnapshot[]>(
    () => loadLocalSnapshots()
  );

  // On open, pull remote snapshots and merge
  useEffect(() => {
    if (!open) return;
    void pullAndMergeSnapshots().then((s) => {
      setAllSnapshots(s);
      setMonths(aggregateByMonth(s));
    });
  }, [open]);

  // Build current month day-by-day data
  const monthDayKeys = currentMonthDays();
  const snapMap = new Map(allSnapshots.map((s) => [s.day, s]));
  const currentDays = monthDayKeys.map((day) => {
    const snap = snapMap.get(day);
    return {
      day,
      cyclesCompleted: snap?.cyclesCompleted ?? 0,
      tasksCompleted: snap?.tasksCompleted ?? 0,
      tasksMissed: snap?.tasksMissed ?? 0,
      totalDoneMin: snap?.totalDoneMin ?? 0,
      hasData: !!snap,
    };
  });

  // Previous months = all months except the current one
  const curKey = currentMonthKey();
  const previousMonths = months.filter((m) => m.month !== curKey);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-panel/50 py-3 tracked text-[10px] text-muted transition-colors hover:border-orange/60 hover:text-orange"
      >
        <span className="text-sm">📊</span>
        {open ? "close monthly progress" : "monthly progress"}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="text-xs leading-none"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="surface relative isolate mt-4 overflow-hidden rounded-2xl border border-line bg-panel">
              <CornerGlow />
              <div className="flex items-center gap-2 border-b border-line-soft px-5 py-3">
                <span className="tracked text-[10px] text-orange">
                  [ monthly progress ]
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setView("current")}
                    className={`rounded-md px-2.5 py-1 text-[9px] tracked transition-colors ${
                      view === "current"
                        ? "bg-orange text-[color:var(--color-orange-ink)]"
                        : "text-faint hover:text-muted"
                    }`}
                  >
                    this month
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("previous")}
                    className={`rounded-md px-2.5 py-1 text-[9px] tracked transition-colors ${
                      view === "previous"
                        ? "bg-orange text-[color:var(--color-orange-ink)]"
                        : "text-faint hover:text-muted"
                    }`}
                  >
                    previous
                  </button>
                </div>
              </div>

              <div className="p-6">
                <AnimatePresence mode="wait">
                  {view === "current" ? (
                    <motion.div
                      key="current"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CurrentMonthView days={currentDays} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="previous"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <PreviousMonthsView months={previousMonths} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Current Month View — 1st to today, day by day
   ═══════════════════════════════════════════════════════════════════════ */

type DayEntry = {
  day: string;
  cyclesCompleted: number;
  tasksCompleted: number;
  tasksMissed: number;
  totalDoneMin: number;
  hasData: boolean;
};

function CurrentMonthView({ days }: { days: DayEntry[] }) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const totalDaysInMonth = daysInCurrentMonth();
  const daysPassed = days.length;

  // Summary stats
  const totalDone = days.reduce((a, d) => a + d.tasksCompleted, 0);
  const totalMissed = days.reduce((a, d) => a + d.tasksMissed, 0);
  const totalCycles = days.reduce((a, d) => a + d.cyclesCompleted, 0);
  const daysActive = days.filter((d) => d.hasData).length;
  const rate =
    totalDone + totalMissed
      ? Math.round((totalDone / (totalDone + totalMissed)) * 100)
      : 0;

  const maxTasks = Math.max(1, ...days.map((d) => d.tasksCompleted + d.tasksMissed));

  return (
    <>
      {/* Month header */}
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-sm font-semibold text-fg">
          {currentMonthLabel()}
        </span>
        <span className="tracked text-[9px] text-faint">
          day {daysPassed}/{totalDaysInMonth}
        </span>
      </div>

      {/* Month progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--color-bar-off)" }}>
        <motion.div
          className="h-full rounded-full bg-orange"
          initial={{ width: 0 }}
          animate={{ width: `${(daysPassed / totalDaysInMonth) * 100}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 26 }}
        />
      </div>
      <div className="mt-1 text-right tracked text-[8px] text-faint">
        {totalDaysInMonth - daysPassed} day{totalDaysInMonth - daysPassed !== 1 ? "s" : ""} remaining
      </div>

      {/* Summary cards */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <MiniStat value={totalDone} label="done" tone="lime" />
        <MiniStat value={totalMissed} label="missed" tone="orange" />
        <MiniStat value={totalCycles} label="cycles" tone="cyan" />
        <MiniStat value={`${rate}%`} label="rate" tone="fg" />
      </div>

      <div className="mt-2 text-center tracked text-[9px] text-faint">
        {daysActive} active day{daysActive !== 1 ? "s" : ""} this month
      </div>

      {/* ── Day-by-day rows ── */}
      <div className="mt-4">
        <span className="tracked text-[9px] text-faint">
          daily breakdown · {currentMonthLabel().split(" ")[0]}
        </span>
        <div className="mt-3 max-h-[380px] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
          {days.map((d, i) => {
            const total = d.tasksCompleted + d.tasksMissed;
            const doneW = total ? (d.tasksCompleted / maxTasks) * 100 : 0;
            const missedW = total ? (d.tasksMissed / maxTasks) * 100 : 0;
            const isToday = d.day === todayKey;
            const dayNum = Number(d.day.split("-")[2]);

            return (
              <div key={d.day} className="flex items-center gap-2">
                <span
                  className={`w-[40px] text-right font-mono text-[9px] ${
                    isToday ? "text-orange font-semibold" : "text-muted"
                  }`}
                >
                  {isToday ? "today" : dayNum}
                </span>
                <div
                  className="relative h-6 flex-1 overflow-hidden rounded-md"
                  style={{ backgroundColor: "var(--color-bar-off)" }}
                >
                  {d.hasData ? (
                    <div className="absolute inset-y-0 left-0 flex">
                      <motion.div
                        className="h-full rounded-l-md bg-lime"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.max(doneW, d.tasksCompleted ? 2 : 0)}%`,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 200,
                          damping: 26,
                          delay: i * 0.015,
                        }}
                      />
                      <motion.div
                        className="h-full bg-orange"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.max(missedW, d.tasksMissed ? 2 : 0)}%`,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 200,
                          damping: 26,
                          delay: i * 0.015 + 0.03,
                        }}
                      />
                    </div>
                  ) : null}
                  <span className="relative z-10 flex h-full items-center px-2 font-mono tracked text-[7px] text-fg">
                    {d.hasData
                      ? `${d.tasksCompleted}✓ ${d.tasksMissed}✗ · ${d.cyclesCompleted}c`
                      : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 tracked text-[9px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] bg-lime" /> done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] bg-orange" /> missed
        </span>
      </div>

      <p className="mt-4 border-t border-line-soft pt-3 font-mono text-[10px] leading-relaxed text-faint">
        Tracks from the 1st to the last day of each month.
        When the month ends, its overall progress is automatically saved and a new month begins.
        {" "}{DAILY_CYCLES} cycles/day target ({CYCLE_MIN}m each).
      </p>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Previous Months View — stored month summaries as cards
   ═══════════════════════════════════════════════════════════════════════ */

function PreviousMonthsView({ months }: { months: MonthSummary[] }) {
  if (months.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="tracked text-[11px] text-faint">
          no previous months yet
        </p>
        <p className="mt-2 font-mono text-[10px] text-faint">
          When the current month ends, its overall progress will appear here automatically.
        </p>
      </div>
    );
  }

  // Show newest first
  const sorted = [...months].reverse();

  return (
    <>
      <span className="tracked text-[9px] text-faint">
        completed months · overall progress
      </span>

      <div className="mt-4 space-y-3">
        {sorted.map((m, i) => {
          const total = m.tasksCompleted + m.tasksMissed;
          const rate = total ? Math.round((m.tasksCompleted / total) * 100) : 0;
          const cyclePct = m.maxCycles > 0
            ? Math.round((m.cyclesCompleted / m.maxCycles) * 100)
            : 0;
          const rateColor =
            rate >= 80 ? "text-lime" : rate >= 50 ? "text-amber" : "text-orange";

          return (
            <motion.div
              key={m.month}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-line bg-panel-2 p-4"
            >
              {/* Month header */}
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-sm font-semibold text-fg">
                  {fmtMonthFull(m.month)}
                </span>
                <span className={`display text-2xl tabular-nums ${rateColor}`}>
                  {rate}%
                </span>
              </div>

              {/* Completion bar */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--color-bar-off)" }}>
                <div className="flex h-full">
                  <motion.div
                    className="h-full rounded-l-full bg-lime"
                    initial={{ width: 0 }}
                    animate={{ width: total ? `${(m.tasksCompleted / total) * 100}%` : "0%" }}
                    transition={{ type: "spring", stiffness: 200, damping: 26, delay: i * 0.05 }}
                  />
                  <motion.div
                    className="h-full bg-orange"
                    initial={{ width: 0 }}
                    animate={{ width: total ? `${(m.tasksMissed / total) * 100}%` : "0%" }}
                    transition={{ type: "spring", stiffness: 200, damping: 26, delay: i * 0.05 + 0.05 }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 tracked text-[9px]">
                <span className="text-lime">{m.tasksCompleted} done</span>
                <span className="text-orange">{m.tasksMissed} missed</span>
                <span className="text-cyan">{m.cyclesCompleted}/{m.maxCycles} cycles ({cyclePct}%)</span>
                <span className="text-faint">{m.daysTracked} day{m.daysTracked !== 1 ? "s" : ""} tracked</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 tracked text-[9px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] bg-lime" /> done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] bg-orange" /> missed
        </span>
      </div>

      <p className="mt-5 border-t border-line-soft pt-4 font-mono text-[10px] leading-relaxed text-faint">
        Each month is automatically stored when it ends.
        {" "}{DAILY_CYCLES} cycles/day target. Synced with Supabase when configured.
      </p>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */

function MiniStat({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone: "lime" | "orange" | "cyan" | "fg";
}) {
  const color =
    tone === "lime"
      ? "text-lime"
      : tone === "orange"
      ? "text-orange"
      : tone === "cyan"
      ? "text-cyan"
      : "text-fg";
  return (
    <div className="rounded-lg border border-line-soft bg-panel-2 px-2 py-2 text-center">
      <div className={`display text-xl leading-none tabular-nums ${color}`}>
        {value}
      </div>
      <div className="tracked mt-1 text-[7px] text-faint">{label}</div>
    </div>
  );
}

function fmtMonthFull(ym: string): string {
  const [y, m] = ym.split("-");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[Number(m) - 1]} ${y}`;
}
