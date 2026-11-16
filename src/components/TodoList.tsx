import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import CornerGlow from "./CornerGlow";
import {
  fetchRemoteTodos,
  loadLocalTodos,
  mergeTodos,
  persistTodos,
  pushTodos,
  saveLocalTodos,
  type Todo,
} from "../lib/todos";

const uid = () => Math.random().toString(36).slice(2, 10);

// Whether a task counts as complete: driven by its sub-tasks when it has any.
function isDone(t: Todo): boolean {
  return t.subs.length ? t.subs.every((s) => s.done) : t.done;
}

// A lightweight scratch list — tasks (and sub-tasks) parked here instead of Notion.
export default function TodoList({ onUse }: { onUse?: (text: string) => void }) {
  const [items, setItems] = useState<Todo[]>([]);
  const [draft, setDraft] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set()); // UI-only: collapsed by default
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Show the local copy instantly, then reconcile with Supabase (if configured)
  // and upload anything that only existed in this browser.
  useEffect(() => {
    let cancelled = false;
    setItems(loadLocalTodos());
    void fetchRemoteTodos().then((remote) => {
      if (cancelled || !remote) return;
      setItems((cur) => {
        const merged = mergeTodos(cur, remote);
        saveLocalTodos(merged);
        void pushTodos(merged);
        return merged;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function persist(next: Todo[]) {
    setItems(persistTodos(items, next));
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    persist([{ id: uid(), text, done: false, createdAt: Date.now(), subs: [] }, ...items]);
    setDraft("");
    inputRef.current?.focus();
  }

  function toggle(id: string) {
    persist(
      items.map((t) => {
        if (t.id !== id) return t;
        if (t.subs.length) {
          const next = !t.subs.every((s) => s.done);
          return { ...t, subs: t.subs.map((s) => ({ ...s, done: next })) };
        }
        return { ...t, done: !t.done };
      })
    );
  }

  function remove(id: string) {
    persist(items.filter((t) => t.id !== id));
  }

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function addSub(id: string, e: React.FormEvent) {
    e.preventDefault();
    const text = (subDrafts[id] ?? "").trim();
    if (!text) return;
    persist(
      items.map((t) =>
        t.id === id ? { ...t, subs: [...t.subs, { id: uid(), text, done: false }] } : t
      )
    );
    setSubDrafts((d) => ({ ...d, [id]: "" }));
  }

  function toggleSub(pid: string, sid: string) {
    persist(
      items.map((t) =>
        t.id === pid
          ? { ...t, subs: t.subs.map((s) => (s.id === sid ? { ...s, done: !s.done } : s)) }
          : t
      )
    );
  }

  function removeSub(pid: string, sid: string) {
    persist(
      items.map((t) => (t.id === pid ? { ...t, subs: t.subs.filter((s) => s.id !== sid) } : t))
    );
  }

  const remaining = items.filter((t) => !isDone(t)).length;

  return (
    <div className="surface relative isolate mt-6 overflow-hidden rounded-2xl border border-line bg-panel">
      <CornerGlow />
      <div className="flex items-center gap-2 border-b border-line-soft px-5 py-3">
        <span className="tracked text-[10px] text-orange">[ later list ]</span>
        <span className="ml-auto tracked text-[10px] text-faint tabular-nums">{remaining} open</span>
      </div>

      <div className="p-5">
        <form onSubmit={add} className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Park a task for later…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-3 py-2.5 font-mono text-sm text-fg outline-none transition-colors placeholder:text-faint focus:border-orange"
          />
          <button
            type="submit"
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-lg bg-orange text-xl leading-none text-[color:var(--color-orange-ink)] transition-transform active:scale-95"
            aria-label="Add task"
          >
            +
          </button>
        </form>

        <ul className="mt-4 space-y-1.5">
          <AnimatePresence initial={false}>
            {items.map((t) => {
              const open = openIds.has(t.id);
              const done = isDone(t);
              const doneCount = t.subs.filter((s) => s.done).length;
              return (
                <motion.li
                  key={t.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ type: "spring", stiffness: 340, damping: 30 }}
                  className="rounded-lg border border-transparent transition-colors hover:border-line hover:bg-panel-2"
                >
                  {/* Parent row */}
                  <div className="group flex items-start gap-3 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(t.id)}
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-[10px] transition-colors ${
                        done ? "border-lime bg-lime text-[color:var(--color-lime-ink)]" : "border-line text-transparent hover:border-orange"
                      }`}
                      aria-label={done ? "Mark not done" : "Mark done"}
                    >
                      ✓
                    </button>
                    <span
                      className={`min-w-0 flex-1 break-words [overflow-wrap:anywhere] font-mono text-sm transition-colors ${
                        done ? "text-faint line-through" : "text-fg"
                      }`}
                    >
                      {t.text}
                    </span>

                    {t.subs.length > 0 && (
                      <span className="tracked shrink-0 text-[9px] text-faint tabular-nums">
                        {doneCount}/{t.subs.length}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleOpen(t.id)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted transition-colors hover:bg-panel-2 hover:text-orange"
                      aria-label={open ? "Collapse sub-tasks" : "Expand sub-tasks"}
                      title="Sub-tasks"
                    >
                      <motion.span
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 24 }}
                        className="inline-block text-lg leading-none"
                      >
                        ▾
                      </motion.span>
                    </button>

                    {onUse && (
                      <button
                        type="button"
                        onClick={() => onUse(t.text)}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted opacity-0 transition-all hover:bg-panel-2 hover:text-orange group-hover:opacity-100"
                        aria-label="Send to composer"
                        title="Send to deadline composer"
                      >
                        <span className="text-sm leading-none">↗</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      className="shrink-0 rounded px-1 text-sm leading-none text-faint opacity-0 transition-all hover:text-orange group-hover:opacity-100"
                      aria-label="Delete task"
                    >
                      ×
                    </button>
                  </div>

                  {/* Sub-tasks — collapsed by default */}
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: "spring", stiffness: 320, damping: 34 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-[18px] border-l border-line-soft pl-3 pb-2 pr-2">
                          <ul className="space-y-1">
                            {t.subs.map((s) => (
                              <li key={s.id} className="group/sub flex items-start gap-2.5 py-1">
                                <button
                                  type="button"
                                  onClick={() => toggleSub(t.id, s.id)}
                                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border text-[8px] transition-colors ${
                                    s.done ? "border-lime bg-lime text-[color:var(--color-lime-ink)]" : "border-line text-transparent hover:border-orange"
                                  }`}
                                  aria-label={s.done ? "Mark not done" : "Mark done"}
                                >
                                  ✓
                                </button>
                                <span
                                  className={`min-w-0 flex-1 break-words [overflow-wrap:anywhere] font-mono text-xs transition-colors ${
                                    s.done ? "text-faint line-through" : "text-muted"
                                  }`}
                                >
                                  {s.text}
                                </span>
                                {onUse && (
                                  <button
                                    type="button"
                                    onClick={() => onUse(s.text)}
                                    className="shrink-0 rounded px-1 text-xs leading-none text-faint opacity-0 transition-all hover:text-orange group-hover/sub:opacity-100"
                                    aria-label="Send to composer"
                                    title="Send to deadline composer"
                                  >
                                    ↗
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeSub(t.id, s.id)}
                                  className="shrink-0 rounded px-1 text-xs leading-none text-faint opacity-0 transition-all hover:text-orange group-hover/sub:opacity-100"
                                  aria-label="Delete sub-task"
                                >
                                  ×
                                </button>
                              </li>
                            ))}
                          </ul>

                          <form onSubmit={(e) => addSub(t.id, e)} className="mt-1.5 flex items-center gap-2">
                            <span className="text-faint">+</span>
                            <input
                              value={subDrafts[t.id] ?? ""}
                              onChange={(e) => setSubDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                              placeholder="Add a sub-task…"
                              className="min-w-0 flex-1 bg-transparent font-mono text-xs text-fg outline-none placeholder:text-faint"
                            />
                          </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        {items.length === 0 && (
          <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center tracked text-[10px] text-faint">
            nothing parked yet
          </p>
        )}
      </div>
    </div>
  );
}
