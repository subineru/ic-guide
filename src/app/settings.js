/* User settings (stored locally).  Reduce-motion defaults to the system preference. */
const KEY = 'ic.settings.v1';
export function createSettings({ store, bus, systemReducedMotion = false }) {
  const defaults = { reduceMotion: systemReducedMotion, sound: false, wobble: true };
  let s = Object.assign({}, defaults, store.get(KEY, {}));
  return {
    get: k => s[k],
    all: () => Object.assign({}, s),
    set(k, v) { s[k] = v; store.set(KEY, s); bus.emit('settings', k); },
  };
}
