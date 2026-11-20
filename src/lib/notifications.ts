import type { Task } from "./storage";

let swReg: ServiceWorkerRegistration | null = null;

export async function initNotifications(): Promise<void> {
  if ("serviceWorker" in navigator) {
    try {
      swReg = await navigator.serviceWorker.register("/deadline-sw.js");
      await navigator.serviceWorker.ready;
    } catch {
      swReg = null;
    }
  }
}

export function notifyPermission(): NotificationPermission {
  return typeof Notification !== "undefined" ? Notification.permission : "denied";
}

export async function requestNotify(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function scheduleNotification(task: Task): void {
  navigator.serviceWorker?.controller?.postMessage({ type: "SCHEDULE", task });
  swReg?.active?.postMessage({ type: "SCHEDULE", task });
}

// Re-arm every still-pending deadline. Called on load and whenever the tab
// becomes visible again, since a backgrounded/evicted service worker may have
// dropped its timers while we were away.
export function armAll(tasks: Task[]): void {
  const now = Date.now();
  tasks.forEach((t) => {
    if (t.status === "active" && t.deadline > now) scheduleNotification(t);
  });
}

export function cancelNotification(id: string): void {
  navigator.serviceWorker?.controller?.postMessage({ type: "CANCEL", id });
  swReg?.active?.postMessage({ type: "CANCEL", id });
}

// Fired from the page when a deadline elapses while the app is open, in case
// the SW timer was evicted. Deduped by the SW's tag.
export function fireNow(task: Task): void {
  if (notifyPermission() !== "granted") return;
  const body = task.consequence
    ? `Missed. Consequence: ${task.consequence}`
    : "This deadline has passed.";
  if (swReg) {
    swReg.showNotification(`⌁ ${task.title}`, {
      body,
      icon: "/app-icon.png",
      tag: `deadline-${task.id}`,
      requireInteraction: true,
    });
  } else {
    new Notification(`⌁ ${task.title}`, { body, icon: "/app-icon.png", tag: `deadline-${task.id}` });
  }
}
