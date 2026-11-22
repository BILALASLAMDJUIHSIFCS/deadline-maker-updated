// Local-first storage: localStorage is the instant cache (the app boots with no
// network round-trip and keeps working offline), and Supabase is the durable
// source of truth when it is configured. We keep at most 7 rolling days.

import { supabase } from "./supabase";
import { tracked } from "./sync";

export type TaskStatus = "active" | "done" | "missed";

export type Task = {
  id: string;
  title: string;
  consequence: string;
  createdAt: number;
  deadline: number;
  status: TaskStatus;
  resolvedAt?: number;
  day: string; // YYYY-MM-DD the task was created
  updatedAt?: number; // last mutation, used to resolve sync conflicts
  pausedAt?: number | null; // set while the timer is paused
  pausedMs?: number; // total time spent paused (deadline is pushed back by this)
};

type TaskRow = {
  id: string;
  title: string;
  consequence: string;
  created_at: number;
  deadline: number;
  status: TaskStatus;
  resolved_at: number | null;
  day: string;
  updated_at: number;
  paused_at?: number | null;
  paused_ms?: number | null;
};

// Flipped off if the database hasn't run the pause migration yet, so sync keeps
// working (pause state then stays on this device until it's applied).
let pauseColumns = true;
const isMissingColumn = (error: { code?: string; message?: string }) =>
  error.code === "PGRST204" || error.code === "42703" || /column/i.test(error.message ?? "");

const KEY = "deadline-maker:v1";
const TABLE = "tasks";

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function lastSevenDays(): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = 6; i >= 0; i--) {
    out.push(dayKey(now - i * 86_400_000));
  }
  return out;
}

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Task[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    /* storage full or unavailable — app still works in-memory */
  }
}

// Drop anything older than the 7-day window. Called on load and on write.
export function prune(tasks: Task[]): Task[] {
  const keep = new Set(lastSevenDays());
  return tasks.filter((t) => keep.has(t.day));
}

const version = (t: Task) => t.updatedAt ?? t.resolvedAt ?? t.createdAt;

// Union by id; when both sides have a task, the most recently changed wins.
export function mergeTasks(local: Task[], remote: Task[]): Task[] {
  const byId = new Map<string, Task>();
  for (const t of [...local, ...remote]) {
    const cur = byId.get(t.id);
    if (!cur || version(t) > version(cur)) byId.set(t.id, t);
  }
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

const toRow = (t: Task): TaskRow => {
  const row: TaskRow = {
    id: t.id,
    title: t.title,
    consequence: t.consequence,
    created_at: t.createdAt,
    deadline: t.deadline,
    status: t.status,
    resolved_at: t.resolvedAt ?? null,
    day: t.day,
    updated_at: version(t),
  };
  if (pauseColumns) {
    row.paused_at = t.pausedAt ?? null;
    row.paused_ms = t.pausedMs ?? 0;
  }
  return row;
};

const fromRow = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  consequence: r.consequence ?? "",
  createdAt: Number(r.created_at),
  deadline: Number(r.deadline),
  status: r.status,
  resolvedAt: r.resolved_at == null ? undefined : Number(r.resolved_at),
  day: r.day,
  updatedAt: Number(r.updated_at),
  pausedAt: r.paused_at == null ? null : Number(r.paused_at),
  pausedMs: r.paused_ms == null ? 0 : Number(r.paused_ms),
});

export async function fetchRemoteTasks(): Promise<Task[] | null> {
  const client = supabase;
  if (!client) return null;
  return tracked("fetch tasks", async () => {
    const { data, error } = await client
      .from(TABLE)
      .select("*")
      .gte("day", lastSevenDays()[0])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as TaskRow[]).map(fromRow);
  });
}

async function pushTasks(tasks: Task[]): Promise<void> {
  const client = supabase;
  if (!client) return;
  await tracked("save tasks", async () => {
    if (tasks.length) {
      let { error } = await client.from(TABLE).upsert(tasks.map(toRow), { onConflict: "id" });
      if (error && pauseColumns && isMissingColumn(error)) {
        console.warn(
          "[supabase] tasks.paused_at / paused_ms missing — run supabase/migrations/20261123000000_pause_and_new_themes.sql. Pause state stays local until then."
        );
        pauseColumns = false;
        ({ error } = await client.from(TABLE).upsert(tasks.map(toRow), { onConflict: "id" }));
      }
      if (error) throw error;
    }
    // Mirror the local 7-day prune in the database.
    const { error } = await client.from(TABLE).delete().lt("day", lastSevenDays()[0]);
    if (error) throw error;
  });
}

let pending: Task[] | null = null;
let timer: number | undefined;

// Save locally right away and push to Supabase shortly after. Rapid successive
// writes collapse into a single upsert of the latest snapshot.
export function persistTasks(tasks: Task[]): void {
  saveTasks(tasks);
  if (!supabase) return;
  pending = tasks;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const snapshot = pending;
    pending = null;
    if (snapshot) void pushTasks(snapshot);
  }, 400);
}
