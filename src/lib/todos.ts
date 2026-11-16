// Scratch-list storage. Same local-first model as tasks: localStorage (plus a
// mirror key) for instant, offline-safe reads, Supabase as the durable copy.

import { supabase } from "./supabase";
import { tracked } from "./sync";

export type Sub = { id: string; text: string; done: boolean };
export type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  subs: Sub[];
  updatedAt?: number;
};

type TodoRow = {
  id: string;
  text: string;
  done: boolean;
  created_at: number;
  subs: Sub[];
  updated_at: number;
};

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
  const byId = new Map<string, Todo>();
  for (const t of [...local, ...remote]) {
    if (deleted.has(t.id)) continue;
    const cur = byId.get(t.id);
    if (!cur || version(t) > version(cur)) byId.set(t.id, t);
  }
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

const toRow = (t: Todo): TodoRow => ({
  id: t.id,
  text: t.text,
  done: t.done,
  created_at: t.createdAt,
  subs: t.subs,
  updated_at: version(t),
});

const fromRow = (r: TodoRow): Todo => ({
  id: r.id,
  text: r.text,
  done: r.done,
  createdAt: Number(r.created_at),
  subs: Array.isArray(r.subs) ? r.subs : [],
  updatedAt: Number(r.updated_at),
});

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
      const { error } = await client.from(TABLE).upsert(changed.map(toRow), { onConflict: "id" });
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
