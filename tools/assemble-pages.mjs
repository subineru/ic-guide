/* Builds the whole GitHub Pages site: `main` at the root, and every branch named proto/* or feat/* as a preview under
   /preview/<branch>/ (a Pages deployment replaces the whole site, so everything must be built together).
   Usage: node tools/assemble-pages.mjs <outDir>      (run from a full clone: all branches fetched, `main` checked out and built)
   A branch that fails to build is skipped with a warning; it never blocks main. */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] || 'site'), root = process.cwd(), work = path.join(root, '.previews');
const sh = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

fs.rmSync(out, { recursive: true, force: true }); fs.rmSync(work, { recursive: true, force: true });
fs.cpSync(path.join(root, 'dist'), out, { recursive: true });                                  // main, already built by the workflow

const branches = sh("git for-each-ref --format='%(refname:strip=3)' 'refs/remotes/origin/proto/*' 'refs/remotes/origin/feat/*'").split('\n').filter(Boolean);
const made = [];
for (const name of branches) {
  const slug = name.replace(/[^A-Za-z0-9._-]+/g, '-'), dir = path.join(work, slug);
  try {
    sh(`git worktree add --detach "${dir}" "origin/${name}"`);
    if (!fs.existsSync(path.join(dir, 'tools', 'build.mjs'))) throw new Error('這個分支沒有 tools/build.mjs');
    sh('npm ci --no-audit --no-fund', dir); sh('node tools/build.mjs', dir);
    const sha = sh('git rev-parse --short HEAD', dir), dest = path.join(out, 'preview', slug);
    fs.cpSync(path.join(dir, 'dist'), dest, { recursive: true });
    const page = path.join(dest, 'index.html'), badge = `<div style="position:fixed;left:8px;bottom:8px;z-index:99;max-width:70vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#fbeed0;color:#6b4a00;border:1px solid #e3cf9b;border-radius:999px;padding:1px 10px;font:12px/1.6 system-ui,sans-serif;pointer-events:none">預覽版 · ${esc(name)} · ${sha}</div>`;
    fs.writeFileSync(page, fs.readFileSync(page, 'utf8').replace(/<body[^>]*>/, m => m + badge));
    made.push({ name, slug, sha, subject: sh('git log -1 --format=%s', dir) });
    console.log(`預覽 ${name} (${sha}) 完成`);
  } catch (e) { console.warn(`略過預覽 ${name}：${String(e.message || e).split('\n')[0]}`); }
}
fs.mkdirSync(path.join(out, 'preview'), { recursive: true });
fs.writeFileSync(path.join(out, 'preview', 'index.html'), `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>預覽版 · IC 解構室</title>
<body style="font:16px/1.7 system-ui,'Noto Sans TC',sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;background:#f6f1e7;color:#2b2620">
<h1 style="font-size:1.3rem">預覽版（尚未合併進正式網站）</h1><p><a href="../">回到正式網站</a></p>
${made.length ? `<ul>${made.map(b => `<li><a href="${esc(b.slug)}/">${esc(b.name)}</a> <small style="color:#5a5144">${esc(b.sha)} · ${esc(b.subject)}</small></li>`).join('')}</ul>` : '<p>目前沒有預覽分支。</p>'}</body></html>`);
fs.rmSync(work, { recursive: true, force: true }); sh('git worktree prune');
console.log(`網站完成：${out}（預覽 ${made.length} 個）`);
