import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Check, PictureInPicture2, X } from "lucide-react";
import BarArray from "./BarArray";
import { type Task } from "../lib/storage";

/* ── TypeScript shim for the Document Picture-in-Picture API ──────────── */
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: {
        width?: number;
        height?: number;
      }): Promise<Window>;
    };
  }
}

type Props = {
  task: Task;
  onDone: () => void;
  onClose: () => void;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function decompose(ms: number) {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  return { h, m, s };
}

/* ═══════════════════════════════════════════════════════════════════════
   Fullscreen Timer — large immersive overlay
   ═══════════════════════════════════════════════════════════════════════ */

export default function FullscreenTimer({ task, onDone, onClose }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  // Close when the task is no longer active (marked done / missed)
  useEffect(() => {
    if (task.status !== "active") onClose();
  }, [task.status, onClose]);

  const total = task.deadline - task.createdAt;
  const remaining = Math.max(0, task.deadline - now);
  const progress = total > 0 ? Math.min(1, (now - task.createdAt) / total) : 1;
  const urgent = remaining < 60_000 * 5;
  const { h, m, s } = decompose(remaining);
  const tone: "cyan" | "amber" | "orange" = remaining <= 0 ? "orange" : urgent ? "amber" : "cyan";

  const pctLeft = total > 0 ? Math.round((remaining / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "var(--app-bg)", backgroundAttachment: "fixed" }}
    >
      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-4">
        <button
          onClick={onClose}
          className="tracked flex items-center gap-2 rounded-md border border-line bg-panel px-4 py-2 text-[10px] text-muted transition-colors hover:border-orange hover:text-orange"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          back
        </button>
        <PipButton task={task} onDone={onDone} />
      </div>

      {/* Center content */}
      <div className="flex w-full max-w-3xl flex-col items-center px-6">
        {/* Task title */}
        <h2 className="text-center font-mono text-lg font-semibold text-fg sm:text-2xl">
          {task.title}
        </h2>

        {task.consequence && (
          <p className="mt-3 rounded-md border border-line bg-panel-2 px-4 py-2 text-center font-mono text-xs text-muted">
            else → {task.consequence}
          </p>
        )}

        {/* Giant timer */}
        <div className="mt-10 select-none sm:mt-16">
          <span
            className={`display tabular-nums leading-none ${
              tone === "orange"
                ? "text-orange"
                : tone === "amber"
                ? "text-amber"
                : "text-cyan"
            }`}
            style={{ fontSize: "clamp(4rem, 18vw, 11rem)" }}
          >
            {pad(h)}:{pad(m)}:{pad(s)}
          </span>
        </div>

        {/* Percentage */}
        <p
          className={`mt-4 tracked text-[11px] ${
            tone === "orange"
              ? "text-orange"
              : tone === "amber"
              ? "text-amber"
              : "text-muted"
          }`}
        >
          {pctLeft}% remaining
        </p>

        {/* Progress bar */}
        <BarArray
          progress={progress}
          tone={tone}
          className="mt-8 h-3 w-full"
        />

        {/* Actions */}
        <div className="mt-10 flex items-center gap-4">
          <button
            onClick={() => {
              onDone();
              onClose();
            }}
            className="group relative overflow-hidden rounded-lg bg-lime px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider text-[color:var(--color-lime-ink)] transition-transform active:scale-[0.97]"
          >
            <span className="relative z-10 flex items-center gap-2">
              <Check aria-hidden className="h-4 w-4" strokeWidth={3} />
              Mark Done
            </span>
            <span className="absolute inset-0 -translate-x-full bg-white/25 transition-transform duration-300 group-hover:translate-x-0" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PiP Button — launches a Document Picture-in-Picture floating timer
   ═══════════════════════════════════════════════════════════════════════ */

function PipButton({ task, onDone }: { task: Task; onDone: () => void }) {
  const pipRef = useRef<Window | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);

  const hasPip = typeof window !== "undefined" && !!window.documentPictureInPicture;

  const cleanup = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = undefined;
    pipRef.current = null;
  }, []);

  useEffect(() => () => {
    cleanup();
    pipRef.current?.close();
  }, [cleanup]);

  const openPip = useCallback(async () => {
    if (!window.documentPictureInPicture) return;

    try {
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 340,
        height: 220,
      });
      pipRef.current = pip;

      // Inject styles
      pip.document.head.innerHTML = `
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: #0a0a0a;
            color: #ffffff;
            font-family: 'JetBrains Mono', monospace;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
            user-select: none;
          }
          .title {
            font-size: 11px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #8a8a90;
            max-width: 90%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: center;
          }
          .timer {
            font-family: 'Doto', 'JetBrains Mono', monospace;
            font-size: 56px;
            font-weight: 700;
            line-height: 1;
            margin-top: 10px;
            font-variant-numeric: tabular-nums;
          }
          .timer.cyan { color: #35d6c4; }
          .timer.amber { color: #f5a524; }
          .timer.red { color: #ff6f42; }
          .bar-track {
            width: 85%;
            height: 6px;
            background: rgba(255,255,255,0.09);
            border-radius: 3px;
            margin-top: 14px;
            overflow: hidden;
          }
          .bar-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 0.3s ease, background 0.3s ease;
          }
          .bar-fill.cyan { background: #35d6c4; }
          .bar-fill.amber { background: #f5a524; }
          .bar-fill.red { background: #ff6f42; }
          .btn {
            margin-top: 14px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            padding: 6px 20px;
            border: 1px solid #9bd633;
            background: transparent;
            color: #9bd633;
            border-radius: 6px;
            cursor: pointer;
          }
          .btn:hover { background: #9bd633; color: #0d1a02; }
        </style>
      `;

      pip.document.body.innerHTML = `
        <div class="title">${task.title.replace(/</g, "&lt;")}</div>
        <div id="clock" class="timer cyan">00:00:00</div>
        <div class="bar-track"><div id="bar" class="bar-fill cyan" style="width:0%"></div></div>
        <button id="done-btn" class="btn">✓ done</button>
      `;

      // Wire up done button
      pip.document.getElementById("done-btn")?.addEventListener("click", () => {
        onDone();
        pip.close();
      });

      // Update every 200ms
      const update = () => {
        const now = Date.now();
        const rem = Math.max(0, task.deadline - now);
        const tot = task.deadline - task.createdAt;
        const prog = tot > 0 ? Math.min(1, (now - task.createdAt) / tot) : 1;
        const urg = rem < 60_000 * 5;
        const { h, m, s } = decompose(rem);
        const cls = rem <= 0 ? "red" : urg ? "amber" : "cyan";

        const clock = pip.document.getElementById("clock");
        const bar = pip.document.getElementById("bar");
        if (clock) {
          clock.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
          clock.className = `timer ${cls}`;
        }
        if (bar) {
          bar.style.width = `${prog * 100}%`;
          bar.className = `bar-fill ${cls}`;
        }
      };

      update();
      intervalRef.current = window.setInterval(update, 200);

      pip.addEventListener("pagehide", cleanup);
    } catch (err) {
      console.error("[pip]", err);
    }
  }, [task, onDone, cleanup]);

  if (!hasPip) return null;

  return (
    <button
      onClick={openPip}
      title="Pop-out mini timer (Picture-in-Picture)"
      className="tracked flex items-center gap-2 rounded-md border border-line bg-panel px-4 py-2 text-[10px] text-muted transition-colors hover:border-cyan hover:text-cyan"
    >
      <PictureInPicture2 aria-hidden className="h-3.5 w-3.5" />
      pop out
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MiniFloat — uses Document PiP API to float OUTSIDE the browser tab.
   Falls back to a draggable in-page widget when PiP is unavailable.
   ═══════════════════════════════════════════════════════════════════════ */

export function MiniFloat({
  task,
  onDone,
  onClose,
}: {
  task: Task;
  onDone: () => void;
  onClose: () => void;
}) {
  const pipRef = useRef<Window | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const launched = useRef(false);

  const hasPip =
    typeof window !== "undefined" && !!window.documentPictureInPicture;

  const cleanup = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = undefined;
    pipRef.current = null;
  }, []);

  // Auto-close when the task finishes
  useEffect(() => {
    if (task.status !== "active") {
      pipRef.current?.close();
      cleanup();
      onClose();
    }
  }, [task.status, onClose, cleanup]);

  // On unmount, close the PiP window
  useEffect(
    () => () => {
      cleanup();
      pipRef.current?.close();
    },
    [cleanup]
  );

  // Launch PiP on mount (only once)
  useEffect(() => {
    if (launched.current) return;
    launched.current = true;

    if (!hasPip) return; // fall through to in-page fallback

    void (async () => {
      try {
        const pip = await window.documentPictureInPicture!.requestWindow({
          width: 340,
          height: 220,
        });
        pipRef.current = pip;

        pip.document.head.innerHTML = `
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              background: #0a0a0a;
              color: #ffffff;
              font-family: 'JetBrains Mono', ui-monospace, monospace;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              overflow: hidden;
              user-select: none;
            }
            .title {
              font-size: 11px;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              color: #8a8a90;
              max-width: 90%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              text-align: center;
            }
            .timer {
              font-family: 'Doto', 'JetBrains Mono', ui-monospace, monospace;
              font-size: 52px;
              font-weight: 700;
              line-height: 1;
              margin-top: 8px;
              font-variant-numeric: tabular-nums;
            }
            .timer.cyan { color: #35d6c4; }
            .timer.amber { color: #f5a524; }
            .timer.red { color: #ff6f42; }
            .bar-track {
              width: 85%;
              height: 5px;
              background: rgba(255,255,255,0.09);
              border-radius: 3px;
              margin-top: 12px;
              overflow: hidden;
            }
            .bar-fill {
              height: 100%;
              border-radius: 3px;
              transition: width 0.3s ease, background 0.3s ease;
            }
            .bar-fill.cyan { background: #35d6c4; }
            .bar-fill.amber { background: #f5a524; }
            .bar-fill.red { background: #ff6f42; }
            .actions { display: flex; gap: 8px; margin-top: 12px; }
            .btn {
              font-family: 'JetBrains Mono', ui-monospace, monospace;
              font-size: 10px;
              letter-spacing: 0.14em;
              text-transform: uppercase;
              padding: 5px 16px;
              border-radius: 6px;
              cursor: pointer;
            }
            .btn-done {
              border: 1px solid #9bd633;
              background: transparent;
              color: #9bd633;
            }
            .btn-done:hover { background: #9bd633; color: #0d1a02; }
            .btn-close {
              border: 1px solid #444;
              background: transparent;
              color: #888;
            }
            .btn-close:hover { border-color: #ff6f42; color: #ff6f42; }
          </style>
        `;

        pip.document.body.innerHTML = `
          <div class="title">${task.title.replace(/</g, "&lt;")}</div>
          <div id="clock" class="timer cyan">00:00:00</div>
          <div class="bar-track"><div id="bar" class="bar-fill cyan" style="width:0%"></div></div>
          <div class="actions">
            <button id="done-btn" class="btn btn-done">✓ done</button>
            <button id="close-btn" class="btn btn-close">✕</button>
          </div>
        `;

        pip.document
          .getElementById("done-btn")
          ?.addEventListener("click", () => {
            onDone();
            pip.close();
          });

        pip.document
          .getElementById("close-btn")
          ?.addEventListener("click", () => {
            pip.close();
          });

        // Update loop
        const update = () => {
          const now = Date.now();
          const rem = Math.max(0, task.deadline - now);
          const tot = task.deadline - task.createdAt;
          const prog =
            tot > 0 ? Math.min(1, (now - task.createdAt) / tot) : 1;
          const urg = rem < 60_000 * 5;
          const { h, m, s } = decompose(rem);
          const cls = rem <= 0 ? "red" : urg ? "amber" : "cyan";

          const clock = pip.document.getElementById("clock");
          const bar = pip.document.getElementById("bar");
          if (clock) {
            clock.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
            clock.className = `timer ${cls}`;
          }
          if (bar) {
            bar.style.width = `${prog * 100}%`;
            bar.className = `bar-fill ${cls}`;
          }
        };

        update();
        intervalRef.current = window.setInterval(update, 200);

        // When the PiP window is closed by the user, clean up and notify parent
        pip.addEventListener("pagehide", () => {
          cleanup();
          onClose();
        });
      } catch (err) {
        console.error("[mini-pip]", err);
        // PiP failed — stay mounted so the in-page fallback shows
      }
    })();
  }, []);

  // ── If PiP is active, render nothing in the page ──
  // (The timer lives in the external PiP window.)
  if (hasPip) return null;

  // ── Fallback: draggable in-page floating widget ──
  return <InPageMiniFloat task={task} onDone={onDone} onClose={onClose} />;
}

/* ═══════════════════════════════════════════════════════════════════════
   InPageMiniFloat — the original draggable in-page fallback
   ═══════════════════════════════════════════════════════════════════════ */

function InPageMiniFloat({
  task,
  onDone,
  onClose,
}: {
  task: Task;
  onDone: () => void;
  onClose: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [pos, setPos] = useState({
    x: typeof window !== "undefined" ? window.innerWidth - 330 : 100,
    y: typeof window !== "undefined" ? window.innerHeight - 210 : 100,
  });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (task.status !== "active") onClose();
  }, [task.status, onClose]);

  const remaining = Math.max(0, task.deadline - now);
  const total = task.deadline - task.createdAt;
  const progress = total > 0 ? Math.min(1, (now - task.createdAt) / total) : 1;
  const urgent = remaining < 60_000 * 5;
  const { h, m, s } = decompose(remaining);
  const tone = remaining <= 0 ? "text-orange" : urgent ? "text-amber" : "text-cyan";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 30 }}
      className="fixed z-50 w-[310px] overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
      style={{
        left: pos.x,
        top: pos.y,
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        background: "rgba(10,10,10,0.92)",
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        dragging.current = true;
        offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        setPos({
          x: e.clientX - offset.current.x,
          y: e.clientY - offset.current.y,
        });
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-2">
        <span className="max-w-[200px] truncate font-mono text-[10px] text-muted">
          {task.title}
        </span>
        <button
          onClick={onClose}
          aria-label="Close mini timer"
          className="grid h-6 w-6 place-items-center rounded text-faint transition-colors hover:text-orange"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-col items-center px-4 py-4">
        <span
          className={`display text-[46px] leading-none tabular-nums ${tone}`}
        >
          {pad(h)}:{pad(m)}:{pad(s)}
        </span>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--color-bar-off)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress * 100}%`,
              background:
                remaining <= 0
                  ? "var(--color-orange)"
                  : urgent
                  ? "var(--color-amber)"
                  : "var(--color-cyan)",
            }}
          />
        </div>
        <button
          onClick={() => {
            onDone();
            onClose();
          }}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-lime/30 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-lime transition-colors hover:bg-lime hover:text-[color:var(--color-lime-ink)]"
        >
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
          done
        </button>
      </div>
    </motion.div>
  );
}
