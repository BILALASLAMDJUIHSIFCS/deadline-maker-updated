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
  ArrowRight,
  Bell,
  BellOff,
  Check,
  ChevronDown,
  Cloud,
  CloudAlert,
  CloudOff,
  Link2,
  Lock,
  Maximize2,
  PictureInPicture2,
  RefreshCw,
  X,
} from "lucide-react";
import ProgressPanel from "./components/ProgressPanel";
import { useTodos } from "./lib/useTodos";
import type { Todo } from "./lib/todos";
import { parseTodoText, withBudget } from "./lib/todoTime";
import type { SendRef } from "./components/TodoList";
import {
  dayKey,
  fetchRemoteTasks,
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
import FullscreenTimer, { MiniFloat } from "./components/FullscreenTimer";
import PauseSwitch from "./components/PauseSwitch";
import ThemeFX from "./components/fx/ThemeFX";
import ComposerDecor from "./components/fx/ComposerDecor";
import TurbineOrb from "./components/fx/TurbineOrb";
import {
  durationMs,
  elapsedMs,
  isPaused,
  pauseTask,
  progressOf,
  remainingMs,
  resumeTask,
} from "./lib/taskTime";
import { formatBudget } from "./lib/todoTime";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [miniId, setMiniId] = useState<string | null>(null);
  const [hoverQuick, setHoverQuick] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const todos = useTodos();
  // The later-list item last sent to the composer; the next deadline locked
  // with that same title gets linked to it so its time budget follows the timer.
  const [pendingLink, setPendingLink] = useState<(SendRef & { title: string; budget: number }) | null>(null);
  // Tasks whose final-10s warning has already sounded, so it fires only once.
  const warned = useRef<Set<string>>(new Set());

  // Seed already-passed milestones so a reload (or a freshly synced task from
  // another device) doesn't re-ring them.
  function seedWarnings(list: Task[]) {
    list.forEach((task) => {
      if (task.status !== "active") return;
      const p = progressOf(task, Date.now());
      if (p >= 0.5) warned.current.add(`${task.id}:50`);
      if (p >= 0.8) warned.current.add(`${task.id}:80`);
      if (isPaused(task)) return; // countdown re-arms on resume
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
        if (t.status !== "active" || isPaused(t)) return t;
        const remaining = t.deadline - now;
        const progress = progressOf(t, now);
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

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // When a deadline linked to a later-list item ends (done early or missed),
  // subtract the total time selected for that completed deadline (or elapsed time if missed)
  // from that item's budget. Fully used budgets drop their time suffix.
  const { items: todoItems, commit: commitTodos } = todos;
  useEffect(() => {
    const settle = (text: string, taskId: string | null | undefined) => {
      const task = taskId ? tasksById.get(taskId) : undefined;
      if (!task || task.status === "active") return null;
      const { title, minutes } = parseTodoText(text);
      if (minutes == null) return { text, done: task.status === "done" };
      // When completed via Done, subtract the total duration selected for that deadline.
      // If missed/expired, subtract the elapsed time.
      const selected = Math.max(1, Math.round(durationMs(task) / 60_000));
      const used = task.status === "done" ? selected : Math.round(elapsedMs(task, Date.now()) / 60_000);
      const left = Math.max(0, minutes - used);
      return { text: withBudget(title, left), done: task.status === "done" && left === 0 };
    };
    const needsSettle = todoItems.some(
      (t) => settle(t.text, t.taskId) || t.subs.some((s) => settle(s.text, s.taskId))
    );
    if (!needsSettle) return;
    commitTodos((prev) =>
      prev.map((t): Todo => {
        let next = t;
        const own = settle(t.text, t.taskId);
        if (own) next = { ...next, text: own.text, taskId: null, done: own.done ? true : next.done };
        if (t.subs.some((s) => settle(s.text, s.taskId))) {
          const nextSubs = t.subs.map((s) => {
            const r = settle(s.text, s.taskId);
            return r ? { ...s, text: r.text, taskId: null, done: r.done ? true : s.done } : s;
          });
          const allSubsDone = nextSubs.length > 0 && nextSubs.every((s) => s.done);
          next = {
            ...next,
            subs: nextSubs,
            done: allSubsDone ? true : next.done,
          };
        }
        return next;
      })
    );
  }, [tasksById, todoItems, commitTodos]);

  // Send a later-list item to the composer. Its budget pre-fills the duration,
  // but you can pick any shorter (or longer) time — whatever actually runs on
  // the clock is what gets subtracted from the item when the deadline ends.
  function sendToComposer(ref: SendRef) {
    const { title: name, minutes: budget } = parseTodoText(ref.text);
    const item = todoItems.find((t) => t.id === ref.todoId);
    const linkedTaskId = ref.subId ? item?.subs.find((s) => s.id === ref.subId)?.taskId : item?.taskId;
    const running = linkedTaskId ? tasksById.get(linkedTaskId)?.status === "active" : false;
    setTitle(name);
    if (budget) applyQuick(budget);
    if (running) {
      setPendingLink(null);
      setFlash("ALREADY RUNNING — FINISH IT FIRST");
      window.setTimeout(() => setFlash(null), 2600);
    } else {
      setPendingLink(budget ? { ...ref, title: name, budget } : null);
    }
    titleRef.current?.focus();
    titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function togglePause(id: string) {
    const at = Date.now();
    const cur = tasks.find((t) => t.id === id);
    if (!cur || cur.status !== "active") return;
    const updated = isPaused(cur) ? resumeTask(cur, at) : pauseTask(cur, at);
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? updated : t));
      persistTasks(next);
      return next;
    });
    // Countdown beeps are queued on the audio clock, so silence them and let
    // the tick re-arm any that should still play.
    stopAlarm();
    warned.current.forEach((k) => {
      if (k.endsWith(":cd")) warned.current.delete(k);
    });
    if (isPaused(updated)) cancelNotification(id);
    else scheduleNotification(updated);
  }

  function linkTodo(ref: SendRef, taskId: string) {
    commitTodos((prev) =>
      prev.map((t) => {
        if (t.id !== ref.todoId) return t;
        if (!ref.subId) return { ...t, taskId };
        return { ...t, subs: t.subs.map((s) => (s.id === ref.subId ? { ...s, taskId } : s)) };
      })
    );
  }

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
    if (pendingLink) linkTodo(pendingLink, task.id);
    setPendingLink(null);
    setTitle("");
    setConsequence("");
    titleRef.current?.focus();
  }

  function completeTask(id: string) {
    const target = tasks.find((t) => t.id === id);
    const at = Date.now();
    setTasks((prev) => {
      // A paused task is resumed first so the paused gap isn't counted as work.
      const next = prev.map((t) =>
        t.id === id && t.status === "active"
          ? { ...resumeTask(t, at), status: "done" as const, resolvedAt: at, updatedAt: at }
          : t
      );
      persistTasks(next);
      return next;
    });
    cancelNotification(id);
    stopAlarm(); // silence the final-10s warning if it was already ringing

    if (target) {
      // The total time selected for this completed deadline in minutes
      const selectedMin = Math.max(1, Math.round(durationMs(target) / 60_000));
      commitTodos((prev) =>
        prev.map((t) => {
          let updated = t;
          const isMainLinked =
            t.taskId === id ||
            (!t.taskId &&
              !t.subs.some((s) => s.taskId === id) &&
              parseTodoText(t.text).title.trim().toLowerCase() === target.title.trim().toLowerCase());

          if (isMainLinked) {
            const { title, minutes } = parseTodoText(t.text);
            const left = minutes != null ? Math.max(0, minutes - selectedMin) : null;
            updated = {
              ...updated,
              text: withBudget(title, left),
              taskId: null,
              done: left === 0 ? true : updated.done,
            };
          }
          if (t.subs.some((s) => s.taskId === id)) {
            const nextSubs = updated.subs.map((s) => {
              if (s.taskId !== id) return s;
              const { title, minutes } = parseTodoText(s.text);
              const left = minutes != null ? Math.max(0, minutes - selectedMin) : null;
              return {
                ...s,
                text: withBudget(title, left),
                taskId: null,
                done: left === 0 ? true : s.done,
              };
            });
            const allSubsDone = nextSubs.length > 0 && nextSubs.every((s) => s.done);
            updated = {
              ...updated,
              subs: nextSubs,
              done: allSubsDone ? true : updated.done,
            };
          }
          return updated;
        })
      );
    }
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

  const nearest = active.find((t) => !isPaused(t));
  const orb = { running: !!nearest, progress: nearest ? progressOf(nearest, now) : 0 };
  const budgetLeft = pendingLink ? Math.max(0, pendingLink.budget - totalMinutes) : 0;

  return (
    <div className="bg-app min-h-full w-full">
      {/* subtle top glow (theme-controlled) */}
      <div className="top-glow pointer-events-none fixed inset-x-0 top-0 h-64" />
      {/* theme signature animation layer */}
      <ThemeFX theme={theme} />
      <div className="relative mx-auto grid max-w-[1200px] gap-6 px-4 py-7 lg:grid-cols-[minmax(0,1fr)_408px] lg:py-12 lg:px-8">
        {/* ── Left column ─────────────────────────────── */}
        <div className="min-w-0">
          <Header perm={perm} onEnable={ensurePerm} theme={theme} onTheme={changeTheme} orb={orb} />

          {/* Composer */}
          <div className="composer-wrap relative mt-6">
          <ComposerDecor theme={theme} />
          <form
            onSubmit={createTask}
            className="surface panel-fx relative isolate overflow-hidden rounded-2xl border border-line bg-panel"
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

              <AnimatePresence initial={false}>
                {pendingLink && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-orange/30 bg-orange-soft px-3 py-2">
                      <span className="tracked flex items-center gap-1.5 text-[9px] text-orange">
                        <Link2 aria-hidden className="h-3.5 w-3.5" />
                        linked to later list
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-muted">
                        {formatBudget(pendingLink.budget)} budget − {totalMinutes > 0 ? fmtDuration(totalMinutes).toLowerCase() : "0m"} run ={" "}
                        <span className="font-semibold text-fg">{budgetLeft > 0 ? `${formatBudget(budgetLeft)} left` : "all used"}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingLink(null)}
                        aria-label="Unlink from later list"
                        title="Unlink — the item's budget won't change"
                        className="ml-auto grid h-6 w-6 place-items-center rounded text-muted transition-colors hover:text-orange"
                      >
                        <X aria-hidden className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                <div
                  className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6"
                  onPointerLeave={() => setHoverQuick(null)}
                >
                  {QUICK.map((q) => {
                    const on = totalMinutes === q.m;
                    const num = q.label.replace(/[a-z]/gi, "");
                    const unit = q.label.replace(/[0-9]/g, "");
                    return (
                      <button
                        key={q.label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => applyQuick(q.m)}
                        onPointerEnter={() => setHoverQuick(q.label)}
                        className={`quick-btn relative isolate flex flex-col items-center justify-center rounded-lg py-2.5 transition-all active:scale-[0.94] ${
                          on
                            ? "bg-orange text-[color:var(--color-orange-ink)] ring-1 ring-inset ring-[color:var(--color-orange-ink)]/20"
                            : "border border-line bg-panel-2 text-muted hover:border-orange/60 hover:text-fg"
                        }`}
                      >
                        {hoverQuick === q.label && !on && (
                          <motion.span
                            layoutId="quick-hover-pill"
                            aria-hidden
                            transition={{ type: "spring", stiffness: 520, damping: 38 }}
                            className="quick-hover-pill absolute inset-0 -z-10 rounded-lg bg-orange-soft ring-1 ring-inset ring-orange/25"
                          />
                        )}
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
                  className="btn-primary group relative overflow-hidden rounded-lg bg-orange px-6 py-3.5 font-mono text-sm font-bold uppercase tracking-wider text-[color:var(--color-orange-ink)] transition-transform active:scale-[0.98]"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Lock aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                    Lock in deadline
                    <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                  </span>
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
          </div>

          {/* Active */}
          <SectionLabel text="live deadlines" count={active.length} accent="text-cyan" />
          <div className="mt-4 space-y-3">
            <AnimatePresence initial={false}>
              {active.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  now={now}
                  onDone={() => completeTask(t.id)}
                  onPause={() => togglePause(t.id)}
                  onExpand={() => setExpandedId(t.id)}
                  onMini={() => setMiniId(t.id)}
                />
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
                      className="grid place-items-center"
                    >
                      <ChevronDown aria-hidden className="h-3.5 w-3.5" />
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
            items={todos.items}
            commit={todos.commit}
            tasksById={tasksById}
            now={now}
            onUse={sendToComposer}
          />

          <ProgressPanel tasks={tasks} />
        </aside>
      </div>

      {/* ── Fullscreen timer overlay ─────────────────── */}
      <AnimatePresence>
        {expandedId && (() => {
          const t = tasks.find((x) => x.id === expandedId);
          return t ? (
            <FullscreenTimer
              key={t.id}
              task={t}
              onDone={() => completeTask(t.id)}
              onTogglePause={() => togglePause(t.id)}
              onClose={() => setExpandedId(null)}
            />
          ) : null;
        })()}
      </AnimatePresence>

      {/* ── Floating mini timer ──────────────────────── */}
      <AnimatePresence>
        {miniId && !expandedId && (() => {
          const t = tasks.find((x) => x.id === miniId);
          return t ? (
            <MiniFloat
              key={t.id}
              task={t}
              onDone={() => completeTask(t.id)}
              onTogglePause={() => togglePause(t.id)}
              onClose={() => setMiniId(null)}
            />
          ) : null;
        })()}
      </AnimatePresence>
    </div>
  );
}

const SYNC_LABEL: Record<SyncStatus, { text: string; tone: string; Icon: typeof Cloud; spin?: boolean }> = {
  local: { text: "local only", tone: "text-muted", Icon: CloudOff },
  syncing: { text: "syncing", tone: "text-amber", Icon: RefreshCw, spin: true },
  synced: { text: "cloud synced", tone: "text-cyan", Icon: Cloud },
  error: { text: "sync error", tone: "text-miss", Icon: CloudAlert },
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
      <s.Icon aria-hidden className={`h-3.5 w-3.5 ${s.spin ? "animate-spin [animation-duration:1.4s]" : ""}`} />
      {s.text}
    </span>
  );
}

function Header({
  perm,
  onEnable,
  theme,
  onTheme,
  orb,
}: {
  perm: NotificationPermission;
  onEnable: () => void;
  theme: ThemeId;
  onTheme: (id: ThemeId) => void;
  orb: { running: boolean; progress: number };
}) {
  return (
    <header className="flex flex-wrap items-center gap-4">
      {theme === "turbine" && <TurbineOrb running={orb.running} progress={orb.progress} />}
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
            <Bell aria-hidden className="h-3.5 w-3.5" /> alerts on
          </span>
        ) : (
          <button
            onClick={onEnable}
            className="tracked flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-[10px] text-muted transition-colors hover:border-amber hover:text-amber"
          >
            <BellOff aria-hidden className="h-3.5 w-3.5" />
            {perm === "denied" ? "alerts blocked" : "enable alerts"}
          </button>
        )}
      </div>
    </header>
  );
}

function TaskCard({
  task,
  now,
  onDone,
  onPause,
  onExpand,
  onMini,
}: {
  task: Task;
  now: number;
  onDone?: () => void;
  onPause?: () => void;
  onExpand?: () => void;
  onMini?: () => void;
}) {
  const remaining = remainingMs(task, now);
  const progress = progressOf(task, now);
  const paused = isPaused(task);
  const urgent = task.status === "active" && !paused && remaining < 60_000 * 5;
  const missed = task.status === "missed";
  const done = task.status === "done";
  const tone: "miss" | "amber" | "lime" | "cyan" | "muted" = missed
    ? "miss"
    : done
    ? "lime"
    : paused
    ? "muted"
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
      className={`surface panel-fx relative isolate overflow-hidden rounded-xl border bg-panel p-4 sm:p-5 ${
        missed
          ? "border-miss/40"
          : done
          ? "border-lime/25"
          : paused
          ? "border-dashed border-line"
          : urgent
          ? "border-amber/50"
          : "border-cyan/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-base font-semibold text-fg">{task.title}</div>
          {task.consequence && (
            <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-panel-2 px-2.5 py-1">
              <span className={`tracked text-[8px] ${missed ? "text-miss" : "text-faint"}`}>
                {missed ? "penalty" : "else"}
              </span>
              <span className="truncate font-mono text-xs text-muted">{task.consequence || "—"}</span>
            </div>
          )}
        </div>

        {task.status !== "active" ? (
          <span
            className={`tracked rounded-md px-2.5 py-1 text-[9px] ${
              missed ? "bg-miss text-[color:var(--color-miss-ink)]" : "bg-lime text-[color:var(--color-lime-ink)]"
            }`}
          >
            {missed ? "missed" : "done"}
          </span>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {onPause && <PauseSwitch paused={paused} onToggle={onPause} />}
            {onMini && (
              <button
                onClick={onMini}
                title="Floating mini timer"
                aria-label="Open floating mini timer"
                className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted transition-colors hover:border-cyan hover:text-cyan"
              >
                <PictureInPicture2 aria-hidden className="h-3.5 w-3.5" />
              </button>
            )}
            {onExpand && (
              <button
                onClick={onExpand}
                title="Fullscreen timer"
                aria-label="Open fullscreen timer"
                className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted transition-colors hover:border-cyan hover:text-cyan"
              >
                <Maximize2 aria-hidden className="h-3.5 w-3.5" />
              </button>
            )}
            {onDone && (
              <button
                onClick={onDone}
                className="tracked flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-[9px] text-muted transition-colors hover:border-lime hover:text-lime"
              >
                <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                done
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <span
          className={`display text-3xl leading-none tabular-nums sm:text-4xl ${
            missed
              ? "text-miss"
              : done
              ? "text-lime"
              : paused
              ? "ember-pulse text-muted"
              : urgent
              ? "text-amber"
              : "text-cyan"
          }`}
        >
          {task.status === "active" ? fmtRemaining(remaining) : fmtRemaining(0)}
        </span>
        <span className={`tracked mb-0.5 text-[9px] ${paused ? "text-orange" : "text-faint"}`}>
          {task.status === "active" ? (paused ? "paused" : "remaining") : "elapsed"}
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

function Dot() {
  return <span className="h-2 w-2 rounded-full border border-line" />;
}
