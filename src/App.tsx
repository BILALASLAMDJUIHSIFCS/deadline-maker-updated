import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import BarArray from "./components/BarArray";
import TimeBox from "./components/TimeBox";
import CornerGlow from "./components/CornerGlow";
import TodoList from "./components/TodoList";
import CycleMeter from "./components/CycleMeter";
import ThemePicker from "./components/ThemePicker";
import { loadThemePref, persistTheme, syncTheme, type ThemeId } from "./lib/theme";
import {
  dayKey,
  fetchRemoteTasks,
  lastSevenDays,
  loadTasks,
  mergeTasks,
  persistTasks,
  prune,
  type Task,
} from "./lib/storage";
import { useSyncStatus, type SyncStatus } from "./lib/sync";
import { playAlarm, scheduleCountdown, stopAlarm, unlockAudio } from "./lib/alarm";
import {
  armAll,
  cancelNotification,
  fireNow,
  initNotifications,
  notifyPermission,
  requestNotify,
  scheduleNotification,
} from "./lib/notifications";
import { saveDailySnapshot, snapshotDay } from "./lib/history";
import MonthlyProgress from "./components/MonthlyProgress";

// Quick presets, in minutes — mirrors the fast-select menu.
const QUICK = [
  { label: "5m", m: 5 },
  { label: "10m", m: 10 },
  { label: "15m", m: 15 },
  { label: "25m", m: 25 },
  { label: "30m", m: 30 },
  { label: "45m", m: 45 },
  { label: "50m", m: 50 },
  { label: "1h", m: 60 },
  { label: "2h", m: 120 },
  { label: "4h", m: 240 },
  { label: "8h", m: 480 },
  { label: "1d", m: 1440 },
];

const uid = () => Math.random().toString(36).slice(2, 10);

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

// 12-hour clock split into digits + meridiem (e.g. { time: "03:00", mer: "PM" }).
function fmtClock(ts: number): { time: string; mer: string } {
  const s = new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const [time, mer = ""] = s.split(" ");
  return { time, mer };
}

function fmtDuration(m: number): string {
  if (m >= 1440) return `${(m / 1440).toFixed(m % 1440 ? 1 : 0)}D`;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min ? `${h}H ${min}M` : `${h}H`;
  }
  return `${m}M`;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [now, setNow] = useState(Date.now());
  const [perm, setPerm] = useState<NotificationPermission>("default");

  const [title, setTitle] = useState("");
  const [consequence, setConsequence] = useState("");
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [flash, setFlash] = useState<string | null>(null);
  const [showAllResolved, setShowAllResolved] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(() => loadThemePref().theme);
  const titleRef = useRef<HTMLInputElement>(null);
  // Tasks whose final-10s warning has already sounded, so it fires only once.
  const warned = useRef<Set<string>>(new Set());

  // Seed already-passed milestones so a reload (or a freshly synced task from
  // another device) doesn't re-ring them.
  function seedWarnings(list: Task[]) {
    list.forEach((task) => {
      if (task.status !== "active") return;
      const total = task.deadline - task.createdAt;
      const p = total > 0 ? (Date.now() - task.createdAt) / total : 1;
      if (p >= 0.5) warned.current.add(`${task.id}:50`);
      if (p >= 0.8) warned.current.add(`${task.id}:80`);
      // If we land within the countdown window, arm it straight away
      // (already-elapsed seconds are skipped) and mark it done so the tick
      // doesn't schedule it a second time.
      const rem = task.deadline - Date.now();
      const cd = `${task.id}:cd`;
      if (rem > 0 && rem <= 120_000 && !warned.current.has(cd)) {
        warned.current.add(cd);
        scheduleCountdown(rem);
      }
    });
  }

  // Reconcile with Supabase: newest version of each task wins, then push the
  // merged set back so local-only tasks reach the database.
  async function pullRemote() {
    const remote = await fetchRemoteTasks();
    if (!remote) return;
    setTasks((cur) => {
      const merged = prune(mergeTasks(cur, remote));
      seedWarnings(merged);
      armAll(merged);
      persistTasks(merged);
      return merged;
    });
  }

  useEffect(() => {
    const t = prune(loadTasks());
    setTasks(t);
    setPerm(notifyPermission());
    seedWarnings(t);
    void initNotifications().then(() => armAll(t));
    void pullRemote();
    void syncTheme(loadThemePref()).then(setTheme);
  }, []);

  function changeTheme(id: ThemeId) {
    persistTheme(id);
    setTheme(id);
  }

  // When the tab wakes from the background, immediately re-check for elapsed
  // deadlines (background timers are throttled) and re-arm pending ones.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      setTasks((cur) => {
        armAll(cur);
        return cur;
      });
      void pullRemote();
      void syncTheme(loadThemePref()).then(setTheme);
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, []);

  // Unlock the Web Audio context on the first interaction so the alarm can
  // sound later without a fresh gesture.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setTasks((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        if (t.status !== "active") return t;
        const total = t.deadline - t.createdAt;
        const remaining = t.deadline - now;
        const progress = total > 0 ? (now - t.createdAt) / total : 1;
        const fire = (key: string, dur: number) => {
          const k = `${t.id}:${key}`;
          if (!warned.current.has(k)) {
            warned.current.add(k);
            playAlarm(dur);
          }
        };
        // Milestone chimes (2.3s) at half and 80% elapsed…
        if (progress >= 0.5) fire("50", 2300);
        if (progress >= 0.8) fire("80", 2300);
        // …and the final-10s countdown. Schedule it once, on the first tick
        // within 2 min of the deadline, at absolute audio-clock times. The
        // 2-min window is wider than the ~1-min background tick throttle, so a
        // background tick is guaranteed to land in it and arm the countdown;
        // the queued Web Audio beeps then fire in the background regardless.
        if (remaining > 0 && remaining <= 120_000) {
          const k = `${t.id}:cd`;
          if (!warned.current.has(k)) {
            warned.current.add(k);
            scheduleCountdown(remaining);
          }
        }
        if (t.deadline <= now) {
          changed = true;
          fireNow(t);
          return { ...t, status: "missed" as const, resolvedAt: t.deadline, updatedAt: Date.now() };
        }
        return t;
      });
      if (changed) persistTasks(next);
      return changed ? next : prev;
    });
  }, [now]);

  // Snapshot today's stats whenever tasks change, so monthly history builds up.
  useEffect(() => {
    if (tasks.length === 0) return;
    const today = dayKey(Date.now());
    const snapshot = snapshotDay(tasks, today);
    saveDailySnapshot(snapshot);
  }, [tasks]);

  const totalMinutes = hours * 60 + minutes;
  const fireClock = fmtClock(now + totalMinutes * 60_000);

  function applyQuick(m: number) {
    setHours(Math.floor(m / 60));
    setMinutes(m % 60);
  }

  async function ensurePerm() {
    if (notifyPermission() === "default") {
      const p = await requestNotify();
      setPerm(p);
      return p;
    }
    setPerm(notifyPermission());
    return notifyPermission();
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || totalMinutes <= 0) {
      setFlash(!title.trim() ? "NAME THE TASK FIRST" : "PICK A DURATION");
      window.setTimeout(() => setFlash(null), 2200);
      return;
    }
    await ensurePerm();
    const created = Date.now();
    const task: Task = {
      id: uid(),
      title: title.trim(),
      consequence: consequence.trim(),
      createdAt: created,
      deadline: created + totalMinutes * 60_000,
      status: "active",
      day: dayKey(created),
      updatedAt: created,
    };
    const next = prune([task, ...tasks]);
    setTasks(next);
    persistTasks(next);
    scheduleNotification(task);
    setTitle("");
    setConsequence("");
    titleRef.current?.focus();
  }

  function completeTask(id: string) {
    setTasks((prev) => {
      const at = Date.now();
      const next = prev.map((t) =>
        t.id === id && t.status === "active"
          ? { ...t, status: "done" as const, resolvedAt: at, updatedAt: at }
          : t
      );
      persistTasks(next);
      return next;
    });
    cancelNotification(id);
    stopAlarm(); // silence the final-10s warning if it was already ringing
  }

  const active = useMemo(
    () => tasks.filter((t) => t.status === "active").sort((a, b) => a.deadline - b.deadline),
    [tasks]
  );
  const resolved = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "active")
        .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0)),
    [tasks]
  );

  const week = useMemo(() => {
    const days = lastSevenDays();
    return days.map((d) => {
      const of = tasks.filter((t) => t.day === d);
      return {
        day: d,
        done: of.filter((t) => t.status === "done").length,
        missed: of.filter((t) => t.status === "missed").length,
        active: of.filter((t) => t.status === "active").length,
        total: of.length,
      };
    });
  }, [tasks]);

  const weekDone = week.reduce((a, d) => a + d.done, 0);
  const weekMissed = week.reduce((a, d) => a + d.missed, 0);
  const weekTotal = week.reduce((a, d) => a + d.total, 0);
  const rate = weekDone + weekMissed ? Math.round((weekDone / (weekDone + weekMissed)) * 100) : 0;

  return (
    <div className="bg-app min-h-full w-full">
      {/* subtle top glow (theme-controlled) */}
      <div className="top-glow pointer-events-none fixed inset-x-0 top-0 h-64" />
      <div className="relative mx-auto grid max-w-[1200px] gap-6 px-4 py-7 lg:grid-cols-[minmax(0,1fr)_408px] lg:py-12 lg:px-8">
        {/* ── Left column ─────────────────────────────── */}
        <div className="min-w-0">
          <Header perm={perm} onEnable={ensurePerm} theme={theme} onTheme={changeTheme} />

          {/* Composer */}
          <form
            onSubmit={createTask}
            className="surface relative isolate mt-6 overflow-hidden rounded-2xl border border-line bg-panel"
          >
            <CornerGlow />
            <div className="flex items-center gap-2 border-b border-line-soft px-5 py-3">
              <span className="tracked text-[10px] text-orange">[ new deadline ]</span>
              <div className="ml-auto flex gap-1.5">
                <Dot /> <Dot /> <Dot />
              </div>
            </div>

            <div className="p-5 sm:p-7">
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full bg-transparent font-mono text-2xl font-semibold text-fg outline-none placeholder:text-faint sm:text-[28px]"
              />

              <label className="mt-6 block">
                <span className="tracked text-[10px] text-faint">If not completed…</span>
                <input
                  value={consequence}
                  onChange={(e) => setConsequence(e.target.value)}
                  placeholder="Donate $20 · No coffee tomorrow · Text the group"
                  className="mt-2 w-full rounded-lg border border-line bg-panel-2 px-3.5 py-3 text-sm text-fg outline-none transition-colors placeholder:text-faint focus:border-orange"
                />
              </label>

              {/* Quick menu */}
              <div className="mt-6">
                <div className="flex items-center gap-2">
                  <span className="tracked text-[10px] text-faint">Quick set</span>
                  <div className="h-px flex-1 bg-line-soft" />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {QUICK.map((q) => {
                    const on = totalMinutes === q.m;
                    const num = q.label.replace(/[a-z]/gi, "");
                    const unit = q.label.replace(/[0-9]/g, "");
                    return (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => applyQuick(q.m)}
                        className={`relative flex flex-col items-center justify-center rounded-lg py-2.5 transition-all active:scale-[0.94] ${
                          on
                            ? "bg-orange text-[color:var(--color-orange-ink)] ring-1 ring-inset ring-[color:var(--color-orange-ink)]/20"
                            : "border border-line bg-panel-2 text-muted hover:border-orange/60 hover:text-fg"
                        }`}
                      >
                        <span className="flex items-baseline gap-0.5">
                          <span className="display text-xl leading-none tabular-nums">{num}</span>
                          <span className="tracked text-[9px] opacity-70">{unit}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Manual entry */}
              <div className="mt-5">
                <span className="tracked text-[10px] text-faint">Or set exactly</span>
                <div className="mt-2.5 flex items-stretch gap-2">
                  <TimeBox
                    label="hrs"
                    value={hours}
                    max={23}
                    onChange={(v) => setHours(v)}
                  />
                  <span className="display self-center text-2xl text-faint">:</span>
                  <TimeBox
                    label="min"
                    value={minutes}
                    max={59}
                    onChange={(v) => setMinutes(v)}
                  />
                </div>
              </div>

              {/* Fires-at readout — LCD style, 12-hour */}
              <div className="mt-6 flex items-center gap-4 rounded-lg border border-line bg-panel-2 px-4 py-3">
                <span className="tracked text-[10px] text-faint">Fires at</span>
                {totalMinutes > 0 ? (
                  <span className="flex items-baseline gap-1.5">
                    <span className="display text-2xl leading-none text-orange">{fireClock.time}</span>
                    <span className="tracked text-xs text-orange">{fireClock.mer}</span>
                  </span>
                ) : (
                  <span className="display text-2xl leading-none text-orange">--:--</span>
                )}
                <span className="ml-auto tracked text-[11px] text-muted">
                  {totalMinutes > 0 ? `in ${fmtDuration(totalMinutes)}` : "set duration"}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="group relative overflow-hidden rounded-lg bg-orange px-6 py-3.5 font-mono text-sm font-bold uppercase tracking-wider text-[color:var(--color-orange-ink)] transition-transform active:scale-[0.98]"
                >
                  <span className="relative z-10">Lock in deadline →</span>
                  <span className="absolute inset-0 -translate-x-full bg-white/25 transition-transform duration-300 group-hover:translate-x-0" />
                </button>
                <AnimatePresence>
                  {flash && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="tracked text-[11px] text-amber"
                    >
                      {flash}
                    </motion.span>
                  )}
                </AnimatePresence>
                <span className="ml-auto tracked text-[9px] text-faint">Locked deadlines can't be deleted</span>
              </div>
            </div>
          </form>

          {/* Active */}
          <SectionLabel text="live deadlines" count={active.length} accent="text-cyan" />
          <div className="mt-4 space-y-3">
            <AnimatePresence initial={false}>
              {active.map((t) => (
                <TaskCard key={t.id} task={t} now={now} onDone={() => completeTask(t.id)} />
              ))}
            </AnimatePresence>
            {active.length === 0 && (
              <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center tracked text-[11px] text-faint">
                no live deadlines — set one above
              </div>
            )}
          </div>

          {/* History — first 10 shown, rest behind a toggle (closed by default) */}
          {resolved.length > 0 && (
            <>
              <SectionLabel text="resolved" count={resolved.length} />
              <div className="mt-4 space-y-3">
                <AnimatePresence initial={false}>
                  {resolved.slice(0, 4).map((t) => (
                    <TaskCard key={t.id} task={t} now={now} />
                  ))}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {showAllResolved &&
                    resolved.slice(4).map((t) => (
                      <TaskCard key={t.id} task={t} now={now} />
                    ))}
                </AnimatePresence>

                {resolved.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllResolved((v) => !v)}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-panel/50 py-3 tracked text-[10px] text-muted transition-colors hover:border-orange/60 hover:text-orange"
                  >
                    {showAllResolved
                      ? "hide older"
                      : `show ${resolved.length - 4} older`}
                    <motion.span
                      animate={{ rotate: showAllResolved ? 180 : 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 24 }}
                      className="text-xs leading-none"
                    >
                      ▾
                    </motion.span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Right column ────────────────────────────── */}
        <aside className="lg:sticky lg:top-12 lg:self-start">
          <CycleMeter tasks={tasks} now={now} />

          <TodoList
            onUse={(text) => {
              setTitle(text);
              titleRef.current?.focus();
              titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />

          <div className="surface relative isolate mt-6 overflow-hidden rounded-2xl border border-line bg-panel">
            <CornerGlow />
            <div className="flex items-center gap-2 border-b border-line-soft px-5 py-3">
              <span className="tracked text-[10px] text-orange">[ 7-day record ]</span>
            </div>

            <div className="p-6">
              <div className="flex items-end justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="display text-6xl leading-none text-fg tabular-nums">{rate}</span>
                  <span className="display text-2xl text-muted">%</span>
                </div>
                <span className="tracked mb-1 text-[10px] text-faint">completion</span>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <Stat n={weekDone} label="done" tone="lime" />
                <Stat n={weekMissed} label="missed" tone="orange" />
                <Stat n={weekTotal} label="total" tone="fg" />
              </div>

              {/* Day bars — stacked array */}
              <div className="mt-8 flex items-end justify-between gap-2">
                {week.map((d, i) => {
                  const max = Math.max(1, ...week.map((x) => x.total));
                  const h = (d.total / max) * 104;
                  const label = new Date(d.day + "T00:00:00").toLocaleDateString([], { weekday: "narrow" });
                  const isToday = i === week.length - 1;
                  return (
                    <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-[104px] w-full items-end">
                        <motion.div
                          className="flex w-full flex-col-reverse overflow-hidden rounded-[3px]"
                          initial={{ height: 0 }}
                          animate={{ height: d.total ? Math.max(6, h) : 3 }}
                          transition={{ delay: i * 0.045, type: "spring", stiffness: 260, damping: 26 }}
                          style={{ backgroundColor: d.total ? undefined : "var(--color-bar-off)" }}
                        >
                          {d.done > 0 && <div style={{ flexGrow: d.done }} className="w-full bg-lime" />}
                          {d.missed > 0 && <div style={{ flexGrow: d.missed }} className="w-full bg-orange" />}
                          {d.active > 0 && <div style={{ flexGrow: d.active }} className="w-full bg-cyan" />}
                        </motion.div>
                      </div>
                      <span className={`tracked text-[9px] ${isToday ? "text-orange" : "text-faint"}`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 tracked text-[9px] text-muted">
                <Legend color="bg-lime" text="done" />
                <Legend color="bg-orange" text="missed" />
                <Legend color="bg-cyan" text="live" />
              </div>

              <p className="mt-6 border-t border-line-soft pt-4 font-mono text-[10px] leading-relaxed text-faint">
                Rolling 7 days. On the 8th day the oldest day drops automatically.
                Stored on this device only.
              </p>
            </div>
          </div>

          <MonthlyProgress />
        </aside>
      </div>
    </div>
  );
}

const SYNC_LABEL: Record<SyncStatus, { text: string; tone: string; dot: string }> = {
  local: { text: "local only", tone: "text-muted", dot: "bg-faint" },
  syncing: { text: "syncing", tone: "text-amber", dot: "bg-amber ember-pulse" },
  synced: { text: "cloud synced", tone: "text-cyan", dot: "bg-cyan" },
  error: { text: "sync error", tone: "text-orange", dot: "bg-orange" },
};

function SyncBadge() {
  const status = useSyncStatus();
  const s = SYNC_LABEL[status];
  return (
    <span
      role="status"
      title={
        status === "local"
          ? "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to sync with Supabase"
          : status === "error"
          ? "Could not reach Supabase — changes are kept locally and retried on next save"
          : undefined
      }
      className={`tracked flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-[10px] ${s.tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.text}
    </span>
  );
}

function Header({
  perm,
  onEnable,
  theme,
  onTheme,
}: {
  perm: NotificationPermission;
  onEnable: () => void;
  theme: ThemeId;
  onTheme: (id: ThemeId) => void;
}) {
  return (
    <header className="flex flex-wrap items-center gap-4">
      <div className="min-w-0">
        <h1 className="display flex items-center text-3xl font-extrabold tracking-tight text-fg sm:text-[40px]">
          DEADLINE<span className="text-orange">//</span>MAKER
        </h1>
        <p className="mt-1 tracked text-[10px] text-muted">set the time — name the stakes — beat the clock</p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ThemePicker value={theme} onChange={onTheme} />
        <SyncBadge />
        {perm === "granted" ? (
          <span className="tracked flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-[10px] text-lime">
            <span className="ember-pulse h-1.5 w-1.5 rounded-full bg-lime" /> alerts on
          </span>
        ) : (
          <button
            onClick={onEnable}
            className="tracked rounded-md border border-line bg-panel px-3 py-2 text-[10px] text-muted transition-colors hover:border-amber hover:text-amber"
          >
            {perm === "denied" ? "alerts blocked" : "[ enable alerts ]"}
          </button>
        )}
      </div>
    </header>
  );
}

function TaskCard({ task, now, onDone }: { task: Task; now: number; onDone?: () => void }) {
  const total = task.deadline - task.createdAt;
  const elapsed = Math.min(total, now - task.createdAt);
  const remaining = task.deadline - now;
  const progress = total > 0 ? elapsed / total : 1;
  const urgent = task.status === "active" && remaining < 60_000 * 5;
  const missed = task.status === "missed";
  const done = task.status === "done";
  const tone: "orange" | "amber" | "lime" | "cyan" = missed
    ? "orange"
    : done
    ? "lime"
    : urgent
    ? "amber"
    : "cyan";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={`surface overflow-hidden rounded-xl border bg-panel p-4 sm:p-5 ${
        missed ? "border-orange/40" : done ? "border-lime/25" : urgent ? "border-amber/50" : "border-cyan/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-base font-semibold text-fg">{task.title}</div>
          {task.consequence && (
            <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-panel-2 px-2.5 py-1">
              <span className={`tracked text-[8px] ${missed ? "text-orange" : "text-faint"}`}>
                {missed ? "penalty" : "else"}
              </span>
              <span className="truncate font-mono text-xs text-muted">{task.consequence || "—"}</span>
            </div>
          )}
        </div>

        {task.status !== "active" ? (
          <span
            className={`tracked rounded-md px-2.5 py-1 text-[9px] ${
              missed ? "bg-orange text-[color:var(--color-orange-ink)]" : "bg-lime text-[color:var(--color-lime-ink)]"
            }`}
          >
            {missed ? "missed" : "done"}
          </span>
        ) : (
          onDone && (
            <button
              onClick={onDone}
              className="tracked rounded-md border border-line px-3 py-1.5 text-[9px] text-muted transition-colors hover:border-lime hover:text-lime"
            >
              mark done
            </button>
          )
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <span
          className={`display text-3xl leading-none tabular-nums sm:text-4xl ${
            missed ? "text-orange" : done ? "text-lime" : urgent ? "text-amber" : "text-cyan"
          }`}
        >
          {task.status === "active" ? fmtRemaining(remaining) : fmtRemaining(0)}
        </span>
        <span className="tracked mb-0.5 text-[9px] text-faint">
          {task.status === "active" ? "remaining" : "elapsed"}
        </span>
      </div>

      <BarArray progress={done || missed ? 1 : progress} tone={tone} className="mt-3 h-2.5" />
    </motion.div>
  );
}

function SectionLabel({ text, count, accent = "text-orange" }: { text: string; count: number; accent?: string }) {
  return (
    <div className="mt-9 flex items-center gap-3">
      <span className={`tracked text-[11px] ${accent}`}>[ {text} ]</span>
      <span className="tracked text-[11px] text-faint tabular-nums">{String(count).padStart(2, "0")}</span>
      <div className="h-px flex-1 bg-line-soft" />
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: "lime" | "orange" | "fg" }) {
  const color = tone === "lime" ? "text-lime" : tone === "orange" ? "text-orange" : "text-fg";
  return (
    <div className="rounded-lg border border-line-soft bg-panel-2 px-3 py-3">
      <div className={`display text-3xl leading-none tabular-nums ${color}`}>{n}</div>
      <div className="tracked mt-1.5 text-[8px] text-faint">{label}</div>
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-[2px] ${color}`} /> {text}
    </span>
  );
}

function Dot() {
  return <span className="h-2 w-2 rounded-full border border-line" />;
}
