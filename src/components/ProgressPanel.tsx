import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChartColumn, TrendingUp } from "lucide-react";
import CornerGlow from "./CornerGlow";
import WeekChart from "./WeekChart";
import MonthView from "./MonthView";
import type { Task } from "../lib/storage";

type View = "week" | "month";

const VIEWS: { id: View; label: string; Icon: typeof ChartColumn }[] = [
  { id: "week", label: "7 days", Icon: ChartColumn },
  { id: "month", label: "month", Icon: CalendarDays },
];

// The 7-day record and monthly progress, one card with a view switch.
export default function ProgressPanel({ tasks }: { tasks: Task[] }) {
  const [view, setView] = useState<View>("week");

  return (
    <section
      aria-labelledby="progress-title"
      className="surface panel-fx relative isolate mt-6 rounded-2xl border border-line bg-panel"
    >
      <CornerGlow />
      <div className="flex items-center gap-2 border-b border-line-soft px-5 py-2.5">
        <TrendingUp aria-hidden className="h-3.5 w-3.5 text-orange" />
        <h2 id="progress-title" className="tracked min-w-0 truncate text-[10px] text-orange">
          {view === "week" ? "[ 7-day record ]" : "[ monthly progress ]"}
        </h2>
        <div role="tablist" aria-label="Progress range" className="ml-auto flex shrink-0 rounded-lg border border-line p-0.5">
          {VIEWS.map(({ id, label, Icon }) => {
            const on = view === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`progress-${id}`}
                onClick={() => setView(id)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 tracked text-[9px] transition-colors ${
                  on ? "text-[color:var(--color-orange-ink)]" : "text-muted hover:text-fg"
                }`}
              >
                {on && (
                  <motion.span
                    layoutId="progress-tab"
                    className="absolute inset-0 rounded-md bg-orange"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon aria-hidden className="relative h-3 w-3" />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            id={`progress-${view}`}
            role="tabpanel"
            initial={{ opacity: 0, x: view === "week" ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: view === "week" ? 10 : -10 }}
            transition={{ duration: 0.18 }}
          >
            {view === "week" ? <WeekChart tasks={tasks} /> : <MonthView tasks={tasks} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
