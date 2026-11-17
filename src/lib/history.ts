// Daily snapshots for monthly history. Same local-first model as tasks:
// localStorage for instant reads, Supabase as the durable copy.
// Each day's stats are snapshotted whenever tasks change.

import { supabase } from "./supabase";
import { tracked } from "./sync";
import { type Task } from "./storage";
import { CYCLE_MIN, DAILY_CYCLES, cyclesForDay } from "./cycles";

export type DailySnapshot = {
  day: string; // YYYY-MM-DD
  cyclesCompleted: number;
  tasksCompleted: number;
  tasksMissed: number;
  totalDoneMin: number;
  updatedAt: number;
};

export type MonthSummary = {
  month: string; // YYYY-MM
  cyclesCompleted: number;
  maxCycles: number; // DAILY_CYCLES × days tracked
  tasksCompleted: number;
  tasksMissed: number;
  daysTracked: number;
};

type SnapshotRow = {
  day: string;
  cycles_completed: number;
  tasks_completed: number;
  tasks_missed: number;
  total_done_min: number;
  updated_at: number;
};

const KEY = "deadline-maker:snapshots:v1";
const TABLE = "daily_snapshots";

function loadLocalSnapshots(): DailySnapshot[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalSnapshots(snapshots: DailySnapshot[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshots));
  } catch {
    /* storage unavailable */
  }
}

/** Compute today's snapshot from the current task list. */
export function snapshotDay(tasks: Task[], day: string): DailySnapshot {
  const stats = cyclesForDay(tasks, day);
  return {
    day,
    cyclesCompleted: Math.floor(stats.doneMin / CYCLE_MIN),
    tasksCompleted: stats.doneCount,
    tasksMissed: stats.missedCount,
    totalDoneMin: stats.doneMin,
    updatedAt: Date.now(),
  };
}

/** Save a daily snapshot locally and push to Supabase. */
export function saveDailySnapshot(snapshot: DailySnapshot): void {
  const all = loadLocalSnapshots();
  const idx = all.findIndex((s) => s.day === snapshot.day);
  if (idx >= 0) all[idx] = snapshot;
  else all.push(snapshot);
  // Keep at most 365 days of local snapshots
  if (all.length > 365) all.splice(0, all.length - 365);
  saveLocalSnapshots(all);
  void pushSnapshot(snapshot);
}

const toRow = (s: DailySnapshot): SnapshotRow => ({
  day: s.day,
  cycles_completed: s.cyclesCompleted,
  tasks_completed: s.tasksCompleted,
  tasks_missed: s.tasksMissed,
  total_done_min: s.totalDoneMin,
  updated_at: s.updatedAt,
});

const fromRow = (r: SnapshotRow): DailySnapshot => ({
  day: r.day,
  cyclesCompleted: r.cycles_completed,
  tasksCompleted: r.tasks_completed,
  tasksMissed: r.tasks_missed,
  totalDoneMin: r.total_done_min,
  updatedAt: r.updated_at,
});

async function pushSnapshot(snapshot: DailySnapshot): Promise<void> {
  const client = supabase;
  if (!client) return;
  await tracked("save snapshot", async () => {
    const { error } = await client
      .from(TABLE)
      .upsert(toRow(snapshot), { onConflict: "day" });
    if (error) throw error;
  });
}

export async function fetchRemoteSnapshots(): Promise<DailySnapshot[] | null> {
  const client = supabase;
  if (!client) return null;
  return tracked("fetch snapshots", async () => {
    const { data, error } = await client
      .from(TABLE)
      .select("*")
      .order("day", { ascending: true });
    if (error) throw error;
    return (data as SnapshotRow[]).map(fromRow);
  });
}

/** Merge local + remote snapshots (newest updatedAt wins per day). */
export async function pullAndMergeSnapshots(): Promise<DailySnapshot[]> {
  const local = loadLocalSnapshots();
  const remote = await fetchRemoteSnapshots();
  if (!remote) return local;

  const byDay = new Map<string, DailySnapshot>();
  for (const s of [...local, ...remote]) {
    const cur = byDay.get(s.day);
    if (!cur || s.updatedAt > cur.updatedAt) byDay.set(s.day, s);
  }
  const merged = [...byDay.values()].sort((a, b) =>
    a.day.localeCompare(b.day)
  );
  saveLocalSnapshots(merged);
  // Push any locally-newer snapshots back to Supabase
  for (const s of merged) {
    const rem = remote.find((r) => r.day === s.day);
    if (!rem || s.updatedAt > rem.updatedAt) void pushSnapshot(s);
  }
  return merged;
}

/** Aggregate daily snapshots into per-month summaries. */
export function aggregateByMonth(snapshots: DailySnapshot[]): MonthSummary[] {
  const byMonth = new Map<string, MonthSummary>();

  for (const s of snapshots) {
    const month = s.day.slice(0, 7); // YYYY-MM
    let m = byMonth.get(month);
    if (!m) {
      m = {
        month,
        cyclesCompleted: 0,
        maxCycles: 0,
        tasksCompleted: 0,
        tasksMissed: 0,
        daysTracked: 0,
      };
      byMonth.set(month, m);
    }
    m.cyclesCompleted += s.cyclesCompleted;
    m.maxCycles += DAILY_CYCLES;
    m.tasksCompleted += s.tasksCompleted;
    m.tasksMissed += s.tasksMissed;
    m.daysTracked++;
  }

  return [...byMonth.values()].sort((a, b) =>
    a.month.localeCompare(b.month)
  );
}

/** Quick access to local-only monthly history (no network). */
export function getLocalMonthlyHistory(): MonthSummary[] {
  return aggregateByMonth(loadLocalSnapshots());
}
