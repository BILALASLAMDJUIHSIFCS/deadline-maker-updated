import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Flag, ListTodo, Plus } from "lucide-react";
import CornerGlow from "./CornerGlow";
import TodoItem, { isDone } from "./TodoItem";
import { TAG_META } from "./TagPicker";
import { TAGS, type Sub, type Tag, type Todo } from "../lib/todos";
import type { Task } from "../lib/storage";

const uid = () => Math.random().toString(36).slice(2, 10);
const VISIBLE = 5;

type Filter = "all" | Tag;

export type SendRef = { todoId: string; subId?: string; text: string };

type Props = {
  items: Todo[];
  commit: (change: (prev: Todo[]) => Todo[]) => void;
  tasksById: Map<string, Task>;
  now: number;
  onUse?: (ref: SendRef) => void;
};

// A lightweight scratch list — tasks (and sub-tasks) parked here instead of Notion.
export default function TodoList({ items, commit, tasksById, now, onUse }: Props) {
  const [draft, setDraft] = useState("");
  const [draftTag, setDraftTag] = useState<Tag | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (id: string, fn: (t: Todo) => Todo) =>
    commit((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));

  function add(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    commit((prev) => [
      { id: uid(), text, done: false, createdAt: Date.now(), subs: [], tag: draftTag, taskId: null },
      ...prev,
    ]);
    setDraft("");
    inputRef.current?.focus();
  }

  function toggle(id: string) {
    update(id, (t) => {
      if (t.subs.length) {
        const next = !t.subs.every((s) => s.done);
        return { ...t, subs: t.subs.map((s) => ({ ...s, done: next })) };
      }
      return { ...t, done: !t.done };
    });
  }

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSub(id: string, e: React.FormEvent) {
    e.preventDefault();
    const text = (subDrafts[id] ?? "").trim();
    if (!text) return;
    update(id, (t) => ({ ...t, subs: [...t.subs, { id: uid(), text, done: false }] }));
    setSubDrafts((d) => ({ ...d, [id]: "" }));
  }

  const editSub = (pid: string, sid: string, fn: (s: Sub) => Sub | null) =>
    update(pid, (t) => ({
      ...t,
      subs: t.subs.flatMap((s) => {
        if (s.id !== sid) return [s];
        const next = fn(s);
        return next ? [next] : [];
      }),
    }));

  const counts = useMemo(() => {
    const open = items.filter((t) => !isDone(t));
    return {
      open: open.length,
      high: items.filter((t) => t.tag === "high").length,
      medium: items.filter((t) => t.tag === "medium").length,
      low: items.filter((t) => t.tag === "low").length,
    };
  }, [items]);

  const filtered = filter === "all" ? items : items.filter((t) => t.tag === filter);
  const visible = showAll ? filtered : filtered.slice(0, VISIBLE);
  const hidden = filtered.length - VISIBLE;

  return (
    <section
      aria-labelledby="later-list-title"
      className="surface panel-fx relative isolate mt-6 rounded-2xl border border-line bg-panel"
    >
      <CornerGlow />
      <div className="flex items-center gap-2 border-b border-line-soft px-5 py-3">
        <ListTodo aria-hidden className="h-3.5 w-3.5 text-orange" />
        <h2 id="later-list-title" className="tracked text-[10px] text-orange">
          [ later list ]
        </h2>
        <span className="ml-auto tracked text-[10px] text-faint tabular-nums">{counts.open} open</span>
      </div>

      <div className="p-5">
        <form onSubmit={add} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Park a task… → 25m"
              aria-label="New later-list task. Add an arrow and a time, like → 1h 30m, to set its budget."
              className="min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-3 py-2.5 font-mono text-sm text-fg outline-none transition-colors placeholder:text-faint focus:border-orange"
            />
            <button
              type="submit"
              className="btn-primary grid h-[42px] w-[42px] shrink-0 place-items-center rounded-lg bg-orange text-[color:var(--color-orange-ink)] transition-transform active:scale-95"
              aria-label="Add task"
            >
              <Plus aria-hidden className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Priority for new task">
            <span className="tracked mr-1 text-[9px] text-faint">tag</span>
            {TAGS.map((tag) => {
              const m = TAG_META[tag];
              const on = draftTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDraftTag(on ? null : tag)}
                  className={`tracked inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] transition-colors ${
                    on ? m.chip : "border-line text-muted hover:text-fg"
                  }`}
                >
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                  {m.label}
                </button>
              );
            })}
            <span className="ml-auto hidden font-mono text-[10px] text-faint sm:inline">
              {"tip: end with → 1h 30m"}
            </span>
          </div>
        </form>

        {items.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1" role="group" aria-label="Filter by tag">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={items.length} />
            {TAGS.map((tag) => (
              <FilterChip
                key={tag}
                active={filter === tag}
                onClick={() => setFilter(tag)}
                label={TAG_META[tag].label}
                count={counts[tag]}
                dot={TAG_META[tag].dot}
              />
            ))}
          </div>
        )}

        <ul className="mt-3 flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {visible.map((t) => (
              <TodoItem
                key={t.id}
                todo={t}
                open={openIds.has(t.id)}
                tasksById={tasksById}
                now={now}
                subDraft={subDrafts[t.id] ?? ""}
                onSubDraft={(v) => setSubDrafts((d) => ({ ...d, [t.id]: v }))}
                onToggle={() => toggle(t.id)}
                onToggleOpen={() => toggleOpen(t.id)}
                onRemove={() => commit((prev) => prev.filter((x) => x.id !== t.id))}
                onTag={(tag) => update(t.id, (x) => ({ ...x, tag }))}
                onAddSub={(e) => addSub(t.id, e)}
                onToggleSub={(sid) => editSub(t.id, sid, (s) => ({ ...s, done: !s.done }))}
                onRemoveSub={(sid) => editSub(t.id, sid, () => null)}
                onUse={
                  onUse
                    ? (sub) => onUse({ todoId: t.id, subId: sub?.id, text: sub ? sub.text : t.text })
                    : undefined
                }
              />
            ))}
          </AnimatePresence>
        </ul>

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line py-2.5 tracked text-[10px] text-muted transition-colors hover:border-orange/60 hover:text-orange"
          >
            {showAll ? "Show less" : `Show ${hidden} more`}
            <motion.span
              animate={{ rotate: showAll ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="grid place-items-center"
            >
              <ChevronDown aria-hidden className="h-3.5 w-3.5" />
            </motion.span>
          </button>
        )}

        {filtered.length === 0 && (
          <p className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-dashed border-line px-4 py-6 text-center tracked text-[10px] text-faint">
            {filter === "all" ? (
              "nothing parked yet"
            ) : (
              <>
                <Flag aria-hidden className={`h-3 w-3 ${TAG_META[filter].text}`} />
                no {TAG_META[filter].label} items
              </>
            )}
          </p>
        )}
      </div>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`tracked inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[9px] transition-colors ${
        active ? "bg-panel-2 text-fg ring-1 ring-inset ring-line" : "text-faint hover:text-muted"
      }`}
    >
      {dot && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
