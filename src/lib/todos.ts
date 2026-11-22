// Scratch-list storage. Same local-first model as tasks: localStorage (plus a
// mirror key) for instant, offline-safe reads, Supabase as the durable copy.

import { supabase } from "./supabase";
import { tracked } from "./sync";

export const TAGS = ["high", "medium", "low"] as const;
export type Tag = (typeof TAGS)[number];
export const isTag = (v: unknown): v is Tag =>
  typeof v === "string" && (TAGS as readonly string[]).includes(v);

// `taskId` links an item to the live deadline it was sent to, so the item's
// time budget can be drawn down by the time actually spent on that deadline.
export type Sub = { id: string; text: string; done: boolean; taskId?: string | null };
export type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  subs: Sub[];
  updatedAt?: number;
  tag?: Tag | null;
  taskId?: string | null;
};

type TodoRow = {
  id: string;
  text: string;
  done: boolean;
  created_at: number;
  subs: Sub[];
  updated_at: number;
  tag?: string | null;
  task_id?: string | null;
};

// Flipped off if the database hasn't run the later-list migration yet, so
// sync keeps working (tag + link then stay on this device until it's applied).
let extendedColumns = true;

const KEY = "deadline-maker:todos:v1";
const BACKUP_KEY = "deadline-maker:todos:v1:backup"; // survives an accidental main-key wipe
// Ids deleted while offline, so a later merge can't resurrect them from Supabase.
const DELETED_KEY = "deadline-maker:todos:v1:pending-deletes";
const TABLE = "todos";

function parse(raw: string | null): Todo[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Todo[];
    if (!Array.isArray(parsed)) return null;
    // Backfill subs on older records.
    return parsed.map((t) => ({ ...t, subs: Array.isArray(t.subs) ? t.subs : [] }));
  } catch {
    return null;
  }
}

// This list is meant to live forever. Read the main key, and if it's missing or
// corrupt, fall back to the mirror so a transient wipe can never lose the list.
export function loadLocalTodos(): Todo[] {
  try {
    return parse(localStorage.getItem(KEY)) ?? parse(localStorage.getItem(BACKUP_KEY)) ?? [];
  } catch {
    return [];
  }
}

export function saveLocalTodos(next: Todo[]): void {
  try {
    const json = JSON.stringify(next);
    localStorage.setItem(KEY, json);
    localStorage.setItem(BACKUP_KEY, json); // mirror every write
  } catch {
    /* storage unavailable */
  }
}

function readPendingDeletes(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DELETED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingDeletes(ids: string[]): void {
  try {
    if (ids.length) localStorage.setItem(DELETED_KEY, JSON.stringify(ids));
    else localStorage.removeItem(DELETED_KEY);
  } catch {
    /* storage unavailable */
  }
}

const version = (t: Todo) => t.updatedAt ?? t.createdAt;

export function mergeTodos(local: Todo[], remote: Todo[]): Todo[] {
  const deleted = new Set(readPendingDeletes());
  const localById = new Map(local.map((t) => [t.id, t]));
  const byId = new Map<string, Todo>();
  for (const t of [...local, ...remote.map((r) => keepLocalMeta(r, localById.get(r.id)))]) {
    if (deleted.has(t.id)) continue;
    const cur = byId.get(t.id);
    if (!cur || version(t) > version(cur)) byId.set(t.id, t);
  }
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

const toRow = (t: Todo): TodoRow => {
  const row: TodoRow = {
    id: t.id,
    text: t.text,
    done: t.done,
    created_at: t.createdAt,
    subs: t.subs,
    updated_at: version(t),
  };
  if (extendedColumns) {
    row.tag = t.tag ?? null;
    row.task_id = t.taskId ?? null;
  }
  return row;
};

const fromRow = (r: TodoRow): Todo => ({
  id: r.id,
  text: r.text,
  done: r.done,
  createdAt: Number(r.created_at),
  subs: Array.isArray(r.subs) ? r.subs : [],
  updatedAt: Number(r.updated_at),
  ...("tag" in r ? { tag: isTag(r.tag) ? r.tag : null } : {}),
  ...("task_id" in r ? { taskId: r.task_id ?? null } : {}),
});

// Remote rows from a database without the new columns carry no tag/link, so
// keep whatever this device already knows instead of wiping it.
function keepLocalMeta(remote: Todo, local: Todo | undefined): Todo {
  if (!local) return remote;
  return {
    ...remote,
    tag: "tag" in remote ? remote.tag : local.tag,
    taskId: "taskId" in remote ? remote.taskId : local.taskId,
  };
}

const isMissingColumn = (error: { code?: string; message?: string }) =>
  error.code === "PGRST204" || error.code === "42703" || /column/i.test(error.message ?? "");

export async function fetchRemoteTodos(): Promise<Todo[] | null> {
  const client = supabase;
  if (!client) return null;
  return tracked("fetch todos", async () => {
    const { data, error } = await client
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as TodoRow[]).map(fromRow);
  });
}

// Upsert the given todos and flush any queued deletions.
export async function pushTodos(changed: Todo[]): Promise<void> {
  const client = supabase;
  if (!client) return;
  await tracked("save todos", async () => {
    if (changed.length) {
      let { error } = await client.from(TABLE).upsert(changed.map(toRow), { onConflict: "id" });
      if (error && extendedColumns && isMissingColumn(error)) {
        console.warn(
          "[supabase] todos.tag / todos.task_id missing — run supabase/migrations/20261122000000_later_list_upgrades.sql. Tags stay local until then."
        );
        extendedColumns = false;
        ({ error } = await client.from(TABLE).upsert(changed.map(toRow), { onConflict: "id" }));
      }
      if (error) throw error;
    }
    const toDelete = readPendingDeletes();
    if (toDelete.length) {
      const { error } = await client.from(TABLE).delete().in("id", toDelete);
      if (error) throw error;
      writePendingDeletes(readPendingDeletes().filter((id) => !toDelete.includes(id)));
    }
  });
}

// Persist a new list. Items whose object identity changed since `prev` were
// edited, so they get a fresh updatedAt and are the only ones upserted.
export function persistTodos(prev: Todo[], next: Todo[]): Todo[] {
  const now = Date.now();
  const prevById = new Map(prev.map((t) => [t.id, t]));
  const changed: Todo[] = [];
  const stamped = next.map((t) => {
    if (prevById.get(t.id) === t) return t;
    const updated = { ...t, updatedAt: now };
    changed.push(updated);
    return updated;
  });

  const nextIds = new Set(next.map((t) => t.id));
  const removed = prev.filter((t) => !nextIds.has(t.id)).map((t) => t.id);
  if (removed.length) writePendingDeletes([...new Set([...readPendingDeletes(), ...removed])]);

  saveLocalTodos(stamped);
  if (supabase && (changed.length || removed.length)) void pushTodos(changed);
  return stamped;
}
