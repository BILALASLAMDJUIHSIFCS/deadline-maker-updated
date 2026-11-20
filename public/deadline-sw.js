// Deadline Maker service worker — best-effort background notifications.
// While the SW is alive it schedules a timer; on any client wake / periodic
// sync it re-checks stored deadlines so overdue tasks still fire on reopen.

const timers = new Map();

function fireNotification(task) {
  const body = task.consequence
    ? `Missed. Consequence: ${task.consequence}`
    : "This deadline has passed.";
  return self.registration.showNotification(`⌁ ${task.title}`, {
    body,
    icon: "/app-icon.png",
    badge: "/app-icon.png",
    tag: `deadline-${task.id}`,
    requireInteraction: true,
    data: { id: task.id },
    silent: false,
  });
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "SCHEDULE") {
    const task = msg.task;
    const delay = task.deadline - Date.now();
    if (timers.has(task.id)) clearTimeout(timers.get(task.id));
    if (delay <= 0) {
      fireNotification(task);
      return;
    }
    // Cap setTimeout to a sane max; long deadlines re-check on reopen.
    const wait = Math.min(delay, 2 ** 31 - 1);
    const t = setTimeout(() => {
      fireNotification(task);
      timers.delete(task.id);
    }, wait);
    timers.set(task.id, t);
  }
  if (msg.type === "CANCEL") {
    if (timers.has(msg.id)) {
      clearTimeout(timers.get(msg.id));
      timers.delete(msg.id);
    }
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
