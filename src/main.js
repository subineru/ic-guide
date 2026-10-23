/* Composition root: the only file that knows every layer.  It builds the objects and hands them down; nothing else
   reaches for globals. */
import { createBus } from './core/events.js';
import { createStore } from './core/store.js';
import { NODES, PATH, SPINE } from './domain/curriculum.js';
import { createProgress } from './domain/progress.js';
import { createRunner } from './app/steps.js';
import { createPlayer } from './app/player.js';
import { createScheduler } from './app/scheduler.js';
import { createRouter } from './app/router.js';
import { createSettings } from './app/settings.js';
import { createTrial } from './app/trial.js';
import { chapterLoaders } from './content/index.js';
import { viewLoaders } from './render/index.js';
import { mountShell } from './ui/shell.js';

const bus = createBus(), store = createStore();
const settings = createSettings({ store, bus, systemReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
const progress = createProgress({ store, bus });
const runner = createRunner({ bus });
const scheduler = createScheduler();
const router = createRouter({ bus });

const trial = /[?&]trial=1(&|$)/.test(location.search) ? createTrial({ store }) : null;      // trial-reading mode: absent unless asked for

const ctx = {
  bus, store, settings, progress, runner, scheduler, router, trial,
  build: window.CF_BUILD || document.querySelector('meta[name=build]')?.content || '',
  nodes: NODES, path: PATH, spine: SPINE,
  nodeOf: id => NODES.find(n => n.id === id),
  defs: () => progress.definitions(),
  isAvailable: id => !!chapterLoaders[id],
  loadChapter: id => chapterLoaders[id](),
  loadView: id => viewLoaders[id](),
  poke: () => scheduler.poke(),
  nextChapter: id => PATH.slice(PATH.indexOf(id) + 1).find(x => chapterLoaders[x]) || null,
  resume: () => PATH.find(id => chapterLoaders[id] && !progress.isComplete(id)) || 'basics',
};

mountShell(ctx, document.getElementById('app'));
document.getElementById('boot')?.remove();
document.documentElement.dataset.ready = '1';

/* The home map shows each chapter's progress, which needs its step list. Only two chapters exist, so read them when the
   browser is idle; once there are many chapters this becomes a small generated manifest instead (docs/ic-spec.md §5). */
const idle = globalThis.requestIdleCallback || (fn => setTimeout(fn, 200));
idle(() => Object.keys(chapterLoaders).forEach(id => chapterLoaders[id]().then(m => { progress.register(m.default); bus.emit('progress'); })));

if (/[?&]test=1/.test(location.search)) globalThis.icDebug = { bus, progress, runner, scheduler, settings, createPlayer, layers: () => import('./ui/stage-layers.js') };
