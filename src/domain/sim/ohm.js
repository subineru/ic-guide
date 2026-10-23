/* Water-pipe picture of voltage / current / resistance.  Values are drawing amounts in 0..1, NOT real units:
   v = how high the water stands (pressure), r = how narrow the pipe is (0.2 = wide open, 1 = very narrow),
   current = how much water flows.  Flow grows with pressure and shrinks as the pipe narrows: current = v / (5 r). */
export const MIN_R = 0.2;
const clamp01 = x => Math.min(1, Math.max(0, x));
export const clampR = r => Math.min(1, Math.max(MIN_R, r));
export const current = (v, r) => clamp01(clamp01(v) / (5 * clampR(r)));
