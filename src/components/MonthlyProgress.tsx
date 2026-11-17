import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import CornerGlow from "./CornerGlow";
import { DAILY_CYCLES } from "../lib/cycles";
import {
  aggregateByMonth,
  getLocalMonthlyHistory,
  pullAndMergeSnapshots,
  type MonthSummary,
} from "../lib/history";

export default function MonthlyProgress() {
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState<MonthSummary[]>(() =>
    getLocalMonthlyHistory().slice(-6)
  );

  // On open, pull remote snapshots and merge
  useEffect(() => {
    if (!open) return;
    void pullAndMergeSnapshots().then((s) => {
      setMonths(aggregateByMonth(s).slice(-6));
    });
  }, [open]);

  const maxCyclesPct = Math.max(1, ...months.map((m) => m.maxCycles));

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
                <span className="ml-auto tracked text-[9px] text-faint">
                  {DAILY_CYCLES} cycles/day target
                </span>
              </div>

              <div className="p-6">
                {months.length === 0 ? (
                  <p className="py-6 text-center tracked text-[11px] text-faint">
                    no data yet — complete tasks to build your history
                  </p>
                ) : (
                  <>
                    {/* ── Cycles chart ── */}
                    <div>
                      <span className="tracked text-[9px] text-faint">
                        cycles completed · per month
                      </span>
                      <div className="mt-3 space-y-2">
                        {months.map((m, i) => {
                          const pct =
                            m.maxCycles > 0
                              ? Math.round(
                                  (m.cyclesCompleted / m.maxCycles) * 100
                                )
                              : 0;
                          const barW = m.maxCycles
                            ? (m.cyclesCompleted / maxCyclesPct) * 100
                            : 0;
                          const label = fmtMonth(m.month);
                          return (
                            <div
                              key={m.month}
                              className="flex items-center gap-3"
                            >
                              <span className="tracked w-14 text-right text-[9px] text-muted">
                                {label}
                              </span>
                              <div
                                className="relative h-7 flex-1 overflow-hidden rounded-md"
                                style={{
                                  backgroundColor: "var(--color-bar-off)",
                                }}
                              >
                                <motion.div
                                  className="absolute inset-y-0 left-0 rounded-md bg-lime"
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: `${Math.max(barW, m.cyclesCompleted ? 3 : 0)}%`,
                                  }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 200,
                                    damping: 26,
                                    delay: i * 0.04,
                                  }}
                                />
                                <span className="relative z-10 flex h-full items-center px-2.5 font-mono tracked text-[8px] text-fg">
                                  {m.cyclesCompleted}/{m.maxCycles}
                                </span>
                              </div>
                              <span className="tracked w-10 text-right text-[9px] tabular-nums text-lime">
                                {pct}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Tasks chart ── */}
                    <div className="mt-6">
                      <span className="tracked text-[9px] text-faint">
                        tasks · per month
                      </span>
                      <div className="mt-3 space-y-2">
                        {months.map((m, i) => {
                          const total =
                            m.tasksCompleted + m.tasksMissed;
                          const maxTotal = Math.max(
                            1,
                            ...months.map(
                              (x) => x.tasksCompleted + x.tasksMissed
                            )
                          );
                          const doneW = total
                            ? (m.tasksCompleted / maxTotal) * 100
                            : 0;
                          const missedW = total
                            ? (m.tasksMissed / maxTotal) * 100
                            : 0;
                          const label = fmtMonth(m.month);
                          return (
                            <div
                              key={m.month}
                              className="flex items-center gap-3"
                            >
                              <span className="tracked w-14 text-right text-[9px] text-muted">
                                {label}
                              </span>
                              <div
                                className="relative h-7 flex-1 overflow-hidden rounded-md"
                                style={{
                                  backgroundColor: "var(--color-bar-off)",
                                }}
                              >
                                <div className="absolute inset-y-0 left-0 flex">
                                  <motion.div
                                    className="h-full rounded-l-md bg-lime"
                                    initial={{ width: 0 }}
                                    animate={{
                                      width: `${Math.max(doneW, m.tasksCompleted ? 3 : 0)}%`,
                                    }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 200,
                                      damping: 26,
                                      delay: i * 0.04,
                                    }}
                                  />
                                  <motion.div
                                    className="h-full bg-orange"
                                    initial={{ width: 0 }}
                                    animate={{
                                      width: `${Math.max(missedW, m.tasksMissed ? 3 : 0)}%`,
                                    }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 200,
                                      damping: 26,
                                      delay: i * 0.04 + 0.06,
                                    }}
                                  />
                                </div>
                                <span className="relative z-10 flex h-full items-center px-2.5 font-mono tracked text-[8px] text-fg">
                                  {m.tasksCompleted} done · {m.tasksMissed}{" "}
                                  missed
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 tracked text-[9px] text-muted">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-[2px] bg-lime" />{" "}
                        done
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-[2px] bg-orange" />{" "}
                        missed
                      </span>
                    </div>

                    <p className="mt-5 border-t border-line-soft pt-4 font-mono text-[10px] leading-relaxed text-faint">
                      Monthly aggregates from daily snapshots.
                      {" "}{DAILY_CYCLES} cycles/day target. Synced with Supabase
                      when configured.
                    </p>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[Number(m) - 1]} '${y.slice(2)}`;
}
