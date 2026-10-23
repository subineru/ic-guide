/* Safe key/value storage. localStorage can throw (private windows, blocked data): fall back to memory.
   The only place in core/domain/content that may touch a browser global (allow-listed in check-deps). */
function defaultBackend() {
  try { const ls = globalThis.localStorage; ls.getItem('_'); return ls; } catch (e) { return null; }
}

export function createStore(backend = defaultBackend()) {
  const mem = new Map();
  return {
    get(key, def) {
      try {
        if (backend) { const v = backend.getItem(key); if (v !== null) return JSON.parse(v); }
      } catch (e) { /* fall through to memory */ }
      return mem.has(key) ? mem.get(key) : def;
    },
    set(key, value) {
      mem.set(key, value);
      try { if (backend) backend.setItem(key, JSON.stringify(value)); } catch (e) { /* memory copy is kept */ }
    },
    remove(key) {
      mem.delete(key);
      try { if (backend) backend.removeItem(key); } catch (e) { /* ignore */ }
    },
  };
}
