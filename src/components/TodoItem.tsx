import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check, ChevronDown, Clock, CornerDownRight, Timer, Trash2 } from "lucide-react";
import TagPicker, { TagChip } from "./TagPicker";
import { formatBudget, parseTodoText } from "../lib/todoTime";
import type { Task } from "../lib/storage";
import type { Sub, Tag, Todo } from "../lib/todos";

export function isDone(t: Todo): boolean {
  return t.subs.length ? t.subs.every((s) => s.done) : t.done;
}

// Hover-revealed on pointer devices, always visible on touch and keyboard focus.
const REVEAL = "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100";

type Budget = { minutes: number; live: boolean } | null;

// Time left on an item: drawn down live while its linked deadline is running.
function budgetOf(text: string, taskId: string | null | undefined, tasksById: Map<string, Task>, now: number): Budget {
  const { minutes } = parseTodoText(text);
  if (minutes == null) return null;
  const task = taskId ? tasksById.get(taskId) : undefined;
  if (task && task.status === "active") {
    const used = (Math.min(now, task.deadline) - task.createdAt) / 60_000;
    return { minutes: Math.max(0, Math.ceil(minutes - used)), live: true };
  }
  return { minutes, live: false };
}

function BudgetChip({ budget, small }: { budget: NonNullable<Budget>; small?: boolean }) {
  const Icon = budget.live ? Timer : Clock;
  return (
    <span
      title={budget.live ? "Counting down with its live deadline" : "Time budget"}
      className={`tracked inline-flex shrink-0 items-center gap-1 rounded border leading-none tabular-nums ${
        small ? "px-1 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[9px]"
      } ${budget.live ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-line bg-panel-2 text-muted"}`}
    >
      <Icon aria-hidden className={small ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {formatBudget(budget.minutes)}
      {budget.live && <span className="ember-pulse ml-0.5 h-1 w-1 rounded-full bg-cyan" />}
    </span>
  );
}

type Props = {
  todo: Todo;
  open: boolean;
  tasksById: Map<string, Task>;
  now: number;
  subDraft: string;
  onSubDraft: (v: string) => void;
  onToggle: () => void;
  onToggleOpen: () => void;
  onRemove: () => void;
  onTag: (tag: Tag | null) => void;
  onAddSub: (e: React.FormEvent) => void;
  onToggleSub: (sid: string) => void;
  onRemoveSub: (sid: string) => void;
  onUse?: (sub?: Sub) => void;
};

export default function TodoItem({
  todo: t,
  open,
  tasksById,
  now,
  subDraft,
  onSubDraft,
  onToggle,
  onToggleOpen,
  onRemove,
  onTag,
  onAddSub,
  onToggleSub,
  onRemoveSub,
  onUse,
}: Props) {
  const done = isDone(t);
  const doneCount = t.subs.filter((s) => s.done).length;
  const { title } = parseTodoText(t.text);
  const budget = budgetOf(t.text, t.taskId, tasksById, now);

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className="relative rounded-lg border border-transparent transition-colors focus-within:z-20 hover:border-line hover:bg-panel-2"
    >
      <div className="group flex items-start gap-2.5 px-2 py-2">
        <button
          type="button"
          onClick={onToggle}
          className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors ${
            done
              ? "border-lime bg-lime text-[color:var(--color-lime-ink)]"
              : "border-line text-transparent hover:border-orange hover:text-faint"
          }`}
          aria-label={done ? "Mark not done" : "Mark done"}
        >
          <Check aria-hidden className="h-3 w-3" strokeWidth={3} />
        </button>

        <div className="min-w-0 flex-1">
          <span
            className={`block break-words font-mono text-sm leading-relaxed transition-colors [overflow-wrap:anywhere] ${
              done ? "text-faint line-through" : "text-fg"
            }`}
          >
            {title}
          </span>
          {(t.tag || budget || t.subs.length > 0) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {t.tag && <TagChip tag={t.tag} />}
              {budget && <BudgetChip budget={budget} />}
              {t.subs.length > 0 && (
                <span className="tracked text-[9px] text-faint tabular-nums">
                  {doneCount}/{t.subs.length} sub
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center">
          <TagPicker value={t.tag} onChange={onTag} className={t.tag ? "" : REVEAL} />

          <button
            type="button"
            onClick={onToggleOpen}
            className="grid h-7 w-7 place-items-center rounded text-muted transition-colors hover:bg-panel-2 hover:text-orange"
            aria-label={open ? "Collapse sub-tasks" : "Expand sub-tasks"}
            aria-expanded={open}
            title="Sub-tasks"
          >
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="grid place-items-center"
            >
              <ChevronDown aria-hidden className="h-4 w-4" />
            </motion.span>
          </button>

          {onUse && (
            <button
              type="button"
              onClick={() => onUse()}
              className={`grid h-7 w-7 place-items-center rounded text-muted transition-all hover:bg-panel-2 hover:text-orange ${REVEAL}`}
              aria-label="Send to deadline composer"
              title={budget ? `Send to composer with ${formatBudget(budget.minutes)}` : "Send to deadline composer"}
            >
              <ArrowUpRight aria-hidden className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onRemove}
            className={`grid h-7 w-7 place-items-center rounded text-faint transition-all hover:bg-panel-2 hover:text-orange ${REVEAL}`}
            aria-label="Delete task"
            title="Delete"
          >
            <Trash2 aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="ml-[18px] border-l border-line-soft pb-2 pl-3 pr-2">
              <ul className="flex flex-col gap-1">
                {t.subs.map((s) => {
                  const subBudget = budgetOf(s.text, s.taskId, tasksById, now);
                  return (
                    <li key={s.id} className="group/sub flex items-start gap-2.5 py-1">
                      <button
                        type="button"
                        onClick={() => onToggleSub(s.id)}
                        className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border transition-colors ${
                          s.done
                            ? "border-lime bg-lime text-[color:var(--color-lime-ink)]"
                            : "border-line text-transparent hover:border-orange"
                        }`}
                        aria-label={s.done ? "Mark not done" : "Mark done"}
                      >
                        <Check aria-hidden className="h-2.5 w-2.5" strokeWidth={3} />
                      </button>
                      <span
                        className={`min-w-0 flex-1 break-words font-mono text-xs leading-relaxed transition-colors [overflow-wrap:anywhere] ${
                          s.done ? "text-faint line-through" : "text-muted"
                        }`}
                      >
                        {parseTodoText(s.text).title}
                      </span>
                      {subBudget && <BudgetChip budget={subBudget} small />}
                      {onUse && (
                        <button
                          type="button"
                          onClick={() => onUse(s)}
                          className="grid h-5 w-5 shrink-0 place-items-center rounded text-faint opacity-100 transition-all hover:text-orange focus-visible:opacity-100 sm:opacity-0 sm:group-hover/sub:opacity-100"
                          aria-label="Send sub-task to deadline composer"
                          title="Send to deadline composer"
                        >
                          <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveSub(s.id)}
                        className="grid h-5 w-5 shrink-0 place-items-center rounded text-faint opacity-100 transition-all hover:text-orange focus-visible:opacity-100 sm:opacity-0 sm:group-hover/sub:opacity-100"
                        aria-label="Delete sub-task"
                      >
                        <Trash2 aria-hidden className="h-3 w-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <form onSubmit={onAddSub} className="mt-1.5 flex items-center gap-2">
                <CornerDownRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-faint" />
                <input
                  value={subDraft}
                  onChange={(e) => onSubDraft(e.target.value)}
                  placeholder="Add a sub-task… (→ 20m)"
                  aria-label="New sub-task"
                  className="min-w-0 flex-1 bg-transparent py-1 font-mono text-xs text-fg outline-none placeholder:text-faint"
                />
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
