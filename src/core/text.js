/* Bilingual text helpers.  A text is a string or {zh, en}. */
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const zh = t => (!t ? '' : typeof t === 'string' ? t : t.zh);
export const en = t => (!t || typeof t === 'string' ? '' : t.en || '');
/* html string: 中文 <span class="en">English</span> */
export const bi = t => (!t ? '' : typeof t === 'string' ? esc(t) : esc(t.zh) + (t.en ? ` <span class="en">${esc(t.en)}</span>` : ''));
/* plain string for aria-labels and titles: 中文 English */
export const biPlain = t => (!t ? '' : typeof t === 'string' ? t : t.zh + (t.en ? ' ' + t.en : ''));
/* number of characters as a reader sees them (used by the content checker) */
export const len = s => [...String(s)].length;
