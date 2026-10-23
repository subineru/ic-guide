/* Where the focus ring goes: the box around one or more target rectangles, padded, kept inside the stage.
   Pure maths (rects are { left, top, width, height } in the same coordinate space), so it is tested without a browser. */
export function focusBox(rects, bounds, { pad = 10, min = 32 } = {}) {
  const ok = (rects || []).filter(r => r && r.width > 0 && r.height > 0);
  if (!ok.length || !bounds || !(bounds.width > 0) || !(bounds.height > 0)) return null;
  let l = Math.min(...ok.map(r => r.left)), t = Math.min(...ok.map(r => r.top));
  let r = Math.max(...ok.map(x => x.left + x.width)), b = Math.max(...ok.map(x => x.top + x.height));
  l -= pad; t -= pad; r += pad; b += pad;
  if (r - l < min) { const c = (l + r) / 2; l = c - min / 2; r = c + min / 2; }
  if (b - t < min) { const c = (t + b) / 2; t = c - min / 2; b = c + min / 2; }
  const bl = bounds.left, bt = bounds.top, br = bounds.left + bounds.width, bb = bounds.top + bounds.height;
  l = Math.max(bl, l); t = Math.max(bt, t); r = Math.min(br, r); b = Math.min(bb, b);
  if (r - l <= 0 || b - t <= 0) return null;                          // the target is entirely outside the stage
  return { x: l - bl, y: t - bt, w: r - l, h: b - t };
}
