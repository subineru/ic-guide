/* View registry: a chapter names its view by id; the code is loaded when the chapter opens. */
export const viewLoaders = {
  'basics.main': () => import('./r2d/views/basics-main.js'),
  'gates.logic': () => import('./r2d/views/gates-logic.js'),
};
