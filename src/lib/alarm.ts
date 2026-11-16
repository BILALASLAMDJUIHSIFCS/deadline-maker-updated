// Procedural alarm that matches the dot-matrix / LCD aesthetic: a clipped
// two-tone square-wave beep sequence, no audio asset required.

let ctx: AudioContext | null = null;
let scheduled: OscillatorNode[] = [];
let scheduledEnd = 0; // AudioContext time up to which beeps are already queued
let phase = 0; // running beep index so the two-tone pattern stays continuous

const CYCLE = 0.44; // seconds between beeps
const BEEP = 0.17; // beep length
const FREQS = [1046.5, 783.99]; // C6 / G5

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

// Browsers block audio until a user gesture — call this from the first click.
export function unlockAudio(): void {
  const c = ensureCtx();
  if (c && c.state === "suspended") void c.resume();
}

export function stopAlarm(): void {
  scheduled.forEach((o) => {
    try {
      o.stop();
      o.disconnect();
    } catch {
      /* already stopped */
    }
  });
  scheduled = [];
  scheduledEnd = 0;
  phase = 0;
}

// Pre-schedule the final-10s countdown at absolute AudioContext times.
// Because the Web Audio clock keeps running in a backgrounded tab, these beeps
// fire precisely even while setInterval is throttled to ~once/minute (which is
// why a per-tick countdown was silent in the background). Call this once, from
// within a couple of minutes of the deadline — later throttling can't affect
// the already-queued audio. `msUntilDeadline` is wall-clock ms remaining.
export function scheduleCountdown(msUntilDeadline: number): void {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();

  const deadlineAt = c.currentTime + msUntilDeadline / 1000; // audio-clock time of the deadline

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2600;
  filter.connect(c.destination);

  // Beeps at 10, 9, … 1 seconds before the deadline; two-tone for a real "tick".
  for (let s = 10; s >= 1; s--) {
    const start = deadlineAt - s;
    if (start <= c.currentTime) continue; // that second already elapsed

    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = FREQS[(10 - s) % 2];

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.24, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + BEEP);

    osc.connect(g);
    g.connect(filter);
    osc.start(start);
    osc.stop(start + BEEP + 0.02);
    scheduled.push(osc);
  }
}

export function playAlarm(durationMs = 10_000): void {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();

  const nowCtx = c.currentTime;
  const targetEnd = nowCtx + durationMs / 1000;

  // Continue from where the current ring leaves off (seamless extend), or start
  // fresh — resetting the two-tone phase — if we've been silent.
  let t: number;
  if (scheduledEnd > nowCtx + 0.05) {
    t = scheduledEnd;
  } else {
    t = nowCtx;
    phase = 0;
  }
  if (targetEnd <= t) return; // nothing new to add

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2600;
  filter.connect(c.destination);

  while (t < targetEnd) {
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = FREQS[phase % 2];

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + BEEP);

    osc.connect(g);
    g.connect(filter);
    osc.start(t);
    osc.stop(t + BEEP + 0.02);
    scheduled.push(osc);

    t += CYCLE;
    phase++;
  }

  scheduledEnd = Math.max(scheduledEnd, targetEnd);
}
