/* Chapter registry.  Each chapter is its own file, loaded on demand (esbuild turns every import() into a separate chunk).
   A chapter that is in the curriculum but not listed here shows as "即將推出". */
export const chapterLoaders = {
  basics: () => import('./chapters/basics.js'),
  gates: () => import('./chapters/gates.js'),
};
export { GLOSSARY } from './glossary.js';
