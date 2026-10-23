/* Hand-drawn ink look for 2D views.  The wobble filter is applied only to STATIC layers: feTurbulence is expensive
   and must never sit on something that moves every frame (spec §5). */
import { s } from './svg.js';

export function inkDefs(id = 'ink-wobble') {
  return s('defs', null,
    s('filter', { id, x: '-5%', y: '-5%', width: '110%', height: '110%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.02', numOctaves: '2', seed: '7', result: 'n' }),
      s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '1.6', xChannelSelector: 'R', yChannelSelector: 'G' })));
}
export const INK = { stroke: 'var(--ink)', width: 2.2, round: { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } };
