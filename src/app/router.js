/* Hash router: works under any GitHub Pages sub-path because it never touches the path part of the URL. */
export function parse(hash) {
  const h = String(hash || '').replace(/^#/, '');
  const m = h.match(/^\/c\/([a-z0-9-]+)$/);
  return m ? { name: 'chapter', id: m[1] } : { name: 'home' };
}
export const href = r => (r.name === 'chapter' ? '#/c/' + r.id : '#/');

export function createRouter({ bus, getHash = () => location.hash, listen = fn => addEventListener('hashchange', fn) }) {
  let cur = parse(getHash());
  listen(() => { cur = parse(getHash()); bus.emit('route', cur); });
  return { get current() { return cur; } };
}
