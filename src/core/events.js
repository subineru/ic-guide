/* Tiny event bus. One instance is created in main.js and passed down; there is no global. */
export function createBus() {
  const map = new Map();
  return {
    on(ev, fn) {
      if (!map.has(ev)) map.set(ev, new Set());
      map.get(ev).add(fn);
      return () => map.get(ev).delete(fn);
    },
    emit(ev, arg) {
      const set = map.get(ev);
      if (set) [...set].forEach(fn => fn(arg));
    },
  };
}
