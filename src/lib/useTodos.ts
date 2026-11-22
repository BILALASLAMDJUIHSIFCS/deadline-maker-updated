import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchRemoteTodos,
  loadLocalTodos,
  mergeTodos,
  persistTodos,
  pushTodos,
  saveLocalTodos,
  type Todo,
} from "./todos";

// Owns the later list so both the list UI and the deadline composer (which
// links items to live deadlines) work from the same copy.
export function useTodos() {
  const [items, setItems] = useState<Todo[]>([]);
  const ref = useRef<Todo[]>(items);

  useEffect(() => {
    let cancelled = false;
    const local = loadLocalTodos();
    ref.current = local;
    setItems(local);
    void fetchRemoteTodos().then((remote) => {
      if (cancelled || !remote) return;
      const merged = mergeTodos(ref.current, remote);
      saveLocalTodos(merged);
      void pushTodos(merged);
      ref.current = merged;
      setItems(merged);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback((change: (prev: Todo[]) => Todo[]) => {
    const prev = ref.current;
    const next = change(prev);
    if (next === prev) return;
    const stamped = persistTodos(prev, next);
    ref.current = stamped;
    setItems(stamped);
  }, []);

  return { items, commit };
}
