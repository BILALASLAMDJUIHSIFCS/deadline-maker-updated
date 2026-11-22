import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flame, Target, Trophy } from "lucide-react";
import { lastSevenDays, type Task } from "../lib/storage";
import { fmtHM, taskMinutes } from "../lib/cycles";

const CHART_H = 128;

type Day = {
  day: string;
  done: number;
  missed: number;
  active: number;
  total: number;
  focusMin: number;
};

const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(day + "T00:00:00").toLocaleDateString([], opts);

export default function WeekChart({ tasks }: { tasks: Task[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const week: Day[] = useMemo(
    () =>
      lastSevenDays().map((d) => {
        const of = tasks.filter((t) => t.day === d);
        const done = of.filter((t) => t.status === "done");
        return {
          day: d,
          done: done.length,
          missed: of.filter((t) => t.status === "missed").length,
          active: of.filter((t) => t.status === "active").length,
          total: of.length,
          focusMin: done.reduce((a, t) => a + taskMinutes(t), 0),
        };
      }),
    [tasks]
  );

  const sum = (k: keyof Omit<Day, "day">) => week.reduce((a, d) => a + d[k], 0);
  const done = sum("done");
  const missed = sum("missed");
  const live = sum("active");
  const focus = sum("focusMin");
  const rate = done + missed ? Math.round((done / (done + missed)) * 100) : 0;
  const max = Math.max(1, ...week.map((d) => d.total));
  const avg = sum("total") / 7;

  const best = week.reduce<Day | null>((b, d) => (d.done > (b?.done ?? 0) ? d : b), null);
  let streak = 0;
  for (let i = week.length - 1; i >= 0; i--) {
    const d = week[i];
    if (d.done > 0) streak++;
    else if (i === week.length - 1 && d.total === 0) continue; // today not started yet
    else break;
  }

  return (
    <div>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          <span className="display text-6xl leading-none text-fg tabular-nums">{rate}</span>
          <span className="display text-2xl text-muted">%</span>
        </div>
        <span className="tracked mb-1 text-[10px] text-faint">completion · 7 days</span>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        <Stat n={done} label="done" tone="text-lime" />
        <Stat n={missed} label="missed" tone="text-miss" />
        <Stat n={live} label="live" tone="text-cyan" />
        <Stat n={focus >= 60 ? `${Math.round(focus / 60)}h` : `${focus}m`} label="focus" tone="text-fg" />
      </div>

      {/* Chart */}
      <div className="relative mt-10" onPointerLeave={() => setHover(null)}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0" style={{ height: CHART_H }}>
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-line-soft" />
          <div className="absolute inset-x-0 border-t border-dashed border-line-soft" style={{ top: CHART_H / 2 }} />
          <span className="tracked absolute -top-2 right-0 bg-transparent text-[8px] text-faint">{max}</span>
          {avg > 0 && (
            <div
              className="absolute inset-x-0 border-t border-orange/50"
              style={{ top: CHART_H - (avg / max) * CHART_H }}
            >
              <span className="tracked absolute -top-3 left-0 text-[8px] text-orange">avg {avg.toFixed(1)}</span>
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-2">
          {week.map((d, i) => {
            const h = d.total ? Math.max(8, (d.total / max) * CHART_H) : 3;
            const isToday = i === week.length - 1;
            const on = hover === i;
            const dayRate = d.done + d.missed ? Math.round((d.done / (d.done + d.missed)) * 100) : null;
            const align = i < 2 ? "left-0" : i > 4 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <div key={d.day} className="relative flex-1">
                <button
                  type="button"
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={() => setHover(on ? null : i)}
                  aria-label={`${fmtDay(d.day, { weekday: "long", month: "short", day: "numeric" })}: ${d.done} completed, ${d.missed} missed, ${d.active} live`}
                  className="flex w-full flex-col items-center gap-2 rounded-md outline-none focus-visible:ring-1 focus-visible:ring-orange"
                >
                  <span className="relative flex w-full items-end" style={{ height: CHART_H }}>
                    <span
                      className={`tracked absolute left-1/2 -translate-x-1/2 text-[9px] tabular-nums transition-colors ${
                        on ? "text-fg" : "text-faint"
                      }`}
                      style={{ bottom: h + 4 }}
                    >
                      {d.total || ""}
                    </span>
                    <motion.span
                      className={`flex w-full flex-col-reverse overflow-hidden rounded-[3px] transition-opacity ${
                        hover !== null && !on ? "opacity-45" : ""
                      }`}
                      initial={{ height: 0 }}
                      animate={{ height: h }}
                      transition={{ delay: i * 0.045, type: "spring", stiffness: 260, damping: 26 }}
                      style={{ backgroundColor: d.total ? undefined : "var(--color-bar-off)" }}
                    >
                      {d.done > 0 && <span style={{ flexGrow: d.done }} className="block w-full bg-lime" />}
                      {d.missed > 0 && <span style={{ flexGrow: d.missed }} className="block w-full bg-miss" />}
                      {d.active > 0 && <span style={{ flexGrow: d.active }} className="block w-full bg-cyan" />}
                    </motion.span>
                  </span>
                  <span className={`tracked text-[9px] ${isToday ? "text-orange" : on ? "text-fg" : "text-faint"}`}>
                    {fmtDay(d.day, { weekday: "short" }).slice(0, 2)}
                  </span>
                </button>

                <AnimatePresence>
                  {on && (
                    <motion.div
                      role="tooltip"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.14 }}
                      className={`surface pointer-events-none absolute z-20 w-40 rounded-lg border border-line p-2.5 text-left ${align}`}
                      style={{ bottom: h + 40, backgroundColor: "var(--color-ink)" }}
                    >
                      <p className="font-mono text-[11px] font-semibold text-fg">
                        {fmtDay(d.day, { weekday: "short", month: "short", day: "numeric" })}
                        {isToday && <span className="tracked ml-1.5 text-[8px] text-orange">today</span>}
                      </p>
                      <dl className="mt-2 flex flex-col gap-1 font-mono text-[11px]">
                        <TipRow color="bg-lime" label="Completed" value={d.done} />
                        <TipRow color="bg-miss" label="Missed" value={d.missed} />
                        {d.active > 0 && <TipRow color="bg-cyan" label="Live" value={d.active} />}
                      </dl>
                      <div className="mt-2 flex justify-between border-t border-line-soft pt-1.5 tracked text-[8px] text-muted">
                        <span>{dayRate === null ? "no result" : `${dayRate}% rate`}</span>
                        <span>{fmtHM(d.focusMin)} focus</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 tracked text-[9px] text-muted">
        <Legend color="bg-lime" text="done" />
        <Legend color="bg-miss" text="missed" />
        <Legend color="bg-cyan" text="live" />
        <span className="flex items-center gap-1.5">
          <span className="h-px w-3 bg-orange/60" /> daily avg
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Highlight
          icon={<Trophy aria-hidden className="h-3.5 w-3.5" />}
          label="best day"
          value={best ? fmtDay(best.day, { weekday: "short" }) : "—"}
          sub={best ? `${best.done} done` : "no wins yet"}
        />
        <Highlight
          icon={<Flame aria-hidden className="h-3.5 w-3.5" />}
          label="streak"
          value={`${streak}d`}
          sub="win days"
        />
        <Highlight
          icon={<Target aria-hidden className="h-3.5 w-3.5" />}
          label="per day"
          value={(done / 7).toFixed(1)}
          sub="avg done"
        />
      </div>

      <p className="mt-5 border-t border-line-soft pt-4 font-mono text-[10px] leading-relaxed text-faint">
        Rolling 7 days — hover or tap a bar for the full breakdown. The oldest day drops off automatically.
      </p>
    </div>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className={`h-2 w-2 rounded-[2px] ${color}`} />
      <dt className="flex-1 text-muted">{label}</dt>
      <dd className="tabular-nums text-fg">{value}</dd>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number | string; label: string; tone: string }) {
  return (
    <div className="rounded-lg border border-line-soft bg-panel-2 px-2.5 py-2.5">
      <div className={`display truncate text-2xl leading-none tabular-nums ${tone}`}>{n}</div>
      <div className="tracked mt-1.5 text-[8px] text-faint">{label}</div>
    </div>
  );
}

function Highlight({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-line-soft px-2.5 py-2.5">
      <div className="flex items-center gap-1.5 text-orange">
        {icon}
        <span className="tracked text-[8px] text-faint">{label}</span>
      </div>
      <div className="mt-1.5 font-mono text-sm font-semibold text-fg">{value}</div>
      <div className="mt-0.5 truncate font-mono text-[10px] text-faint">{sub}</div>
    </div>
  );
}

export function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-[2px] ${color}`} /> {text}
    </span>
  );
}
