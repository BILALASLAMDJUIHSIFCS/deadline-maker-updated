import { useMemo } from "react";
import { motion } from "motion/react";
import CornerGlow from "./CornerGlow";
import { dayKey, type Task } from "../lib/storage";
import {
  CYCLE_MIN,
  DAILY_CYCLES,
  DAILY_TARGET_MIN,
  cyclesForDay,
  fmtCycles,
  fmtHM,
  weekCycles,
} from "../lib/cycles";

type Props = { tasks: Task[]; now: number };

export default function CycleMeter({ tasks, now }: Props) {
  const today = dayKey(now);
  const stats = useMemo(() => cyclesForDay(tasks, today), [tasks, today]);
  const week = useMemo(() => weekCycles(tasks), [tasks, today]);

  const fullCycles = Math.floor(stats.doneMin / CYCLE_MIN);
  const partial = (stats.doneMin % CYCLE_MIN) / CYCLE_MIN;
  const remainingMin = Math.max(0, DAILY_TARGET_MIN - stats.doneMin);
  const cyclesLeft = Math.ceil(remainingMin / CYCLE_MIN);
  const bonusCycles = Math.max(0, fullCycles - DAILY_CYCLES);
  const pct = Math.min(100, Math.round((stats.doneMin / DAILY_TARGET_MIN) * 100));
  const nextCycleIn = CYCLE_MIN - (stats.doneMin % CYCLE_MIN);
  const reached = stats.doneMin >= DAILY_TARGET_MIN;

  return (
    <section
      aria-labelledby="cycle-meter-title"
      className="surface panel-fx relative isolate overflow-hidden rounded-2xl border border-line bg-panel"
    >
      <CornerGlow />
      <div className="flex items-center gap-2 border-b border-line-soft px-5 py-3">
        <h2 id="cycle-meter-title" className="tracked text-[10px] text-orange">
          [ cycle meter ]
        </h2>
        <span className="ml-auto tracked text-[9px] text-faint">
          {DAILY_CYCLES} × {CYCLE_MIN}m = {fmtHM(DAILY_TARGET_MIN)}
        </span>
      </div>

      <div className="p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="display text-6xl leading-none text-fg tabular-nums">
                {Math.min(fullCycles, DAILY_CYCLES)}
              </span>
              <span className="display text-2xl text-muted tabular-nums">/{DAILY_CYCLES}</span>
            </div>
            <p className="tracked mt-2 text-[10px] text-muted">cycles today</p>
          </div>
          <div className="text-right">
            <div className="display text-3xl leading-none text-lime tabular-nums">{pct}%</div>
            <p className="tracked mt-2 text-[9px] text-faint">
              {reached ? "quota hit" : `next cycle in ${nextCycleIn}m`}
            </p>
          </div>
        </div>

        {/* 33 cells — one per 30-minute cycle; the active cell fills partially */}
        <div
          role="img"
          aria-label={`${fullCycles} of ${DAILY_CYCLES} cycles completed`}
          className="mt-6 grid grid-cols-11 gap-1.5"
        >
          {Array.from({ length: DAILY_CYCLES }).map((_, i) => {
            const fill = i < fullCycles ? 1 : i === fullCycles ? partial : 0;
            return (
              <div
                key={i}
                className="relative h-7 overflow-hidden rounded-md"
                style={{ backgroundColor: "var(--color-bar-off)" }}
              >
                <motion.div
                  className="absolute inset-x-0 bottom-0 bg-lime"
                  initial={false}
                  animate={{ height: `${fill * 100}%` }}
                  transition={{ type: "spring", stiffness: 220, damping: 28, delay: Math.min(i, 33) * 0.008 }}
                />
                {i === fullCycles && fill > 0 && (
                  <span className="ember-pulse absolute inset-x-0 top-0 h-0.5 bg-lime" />
                )}
              </div>
            );
          })}
        </div>

        {bonusCycles > 0 && (
          <p className="tracked mt-3 text-[10px] text-lime">+{bonusCycles} bonus cycles beyond quota</p>
        )}

        <dl className="mt-6 grid grid-cols-3 gap-2">
          <Figure
            label="done"
            value={fmtHM(stats.doneMin)}
            sub={`${fmtCycles(stats.doneMin)} cyc · ${stats.doneCount} todo`}
            tone="text-lime"
          />
          <Figure
            label="missed"
            value={fmtHM(stats.missedMin)}
            sub={`${fmtCycles(stats.missedMin)} cyc · ${stats.missedCount} todo`}
            tone="text-miss"
          />
          <Figure
            label="left"
            value={fmtHM(remainingMin)}
            sub={`${cyclesLeft} cyc to go`}
            tone="text-fg"
          />
        </dl>

        {stats.liveMin > 0 && (
          <p className="mt-3 flex items-center gap-2 tracked text-[10px] text-cyan">
            <span className="ember-pulse h-1.5 w-1.5 rounded-full bg-cyan" />
            {fmtHM(stats.liveMin)} live · up to {fmtCycles(stats.liveMin)} more cycles
          </p>
        )}

        {/* Rolling week — cycles completed per day */}
        <div className="mt-6 border-t border-line-soft pt-4">
          <span className="tracked text-[9px] text-faint">cycles · last 7 days</span>
          <div className="mt-3 flex items-end justify-between gap-2">
            {week.map((d) => {
              const c = Math.floor(d.doneMin / CYCLE_MIN);
              const isToday = d.day === today;
              const label = new Date(d.day + "T00:00:00").toLocaleDateString([], { weekday: "narrow" });
              return (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                  <span
                    className={`display text-base leading-none tabular-nums ${
                      c >= DAILY_CYCLES ? "text-lime" : isToday ? "text-fg" : "text-muted"
                    }`}
                  >
                    {c}
                  </span>
                  <div className="h-1 w-full overflow-hidden rounded-md" style={{ backgroundColor: "var(--color-bar-off)" }}>
                    <div
                      className="h-full bg-lime"
                      style={{ width: `${Math.min(100, (d.doneMin / DAILY_TARGET_MIN) * 100)}%` }}
                    />
                  </div>
                  <span className={`tracked text-[9px] ${isToday ? "text-orange" : "text-faint"}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-5 font-mono text-[10px] leading-relaxed text-faint">
          Each completed deadline adds its set duration. Every {CYCLE_MIN} minutes = 1 cycle; missed
          deadlines are tracked as lost time.
        </p>
      </div>
    </section>
  );
}

function Figure({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="rounded-lg border border-line-soft bg-panel-2 px-3 py-3">
      <dt className="tracked text-[8px] text-faint">{label}</dt>
      <dd className={`display mt-1.5 text-xl leading-none tabular-nums ${tone}`}>{value}</dd>
      <dd className="tracked mt-1.5 text-[8px] text-muted">{sub}</dd>
    </div>
  );
}
