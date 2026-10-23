/* The two basic gates, built the way a chip builds them: a pull-up network (switches that connect the output to the
   HIGH rail) and a pull-down network (switches that connect it to the LOW rail).  Every switch is a voltage-controlled
   switch.  Pull-up switches close when their input is 0, pull-down switches close when their input is 1.  For every input
   exactly one network conducts, so the output is never floating and never shorted. */
export const bit = x => (x ? 1 : 0);

export const inverter = a => (bit(a) ? 0 : 1);
export const nand = (a, b) => (bit(a) && bit(b) ? 0 : 1);

/* inverter: one switch up, one switch down */
export function inverterNetwork(a) {
  const up = !bit(a), down = !!bit(a);
  return { switches: { up, down }, pullUp: up, pullDown: down };
}
/* NAND: two switches in PARALLEL up (either one closing is enough), two in SERIES down (both must close) */
export function nandNetwork(a, b) {
  const sw = { upA: !bit(a), upB: !bit(b), downA: !!bit(a), downB: !!bit(b) };
  return { switches: sw, pullUp: sw.upA || sw.upB, pullDown: sw.downA && sw.downB };
}
/* the level the output settles at; throws if the network would float or short (never happens for these gates) */
export function outputOf(net) {
  if (net.pullUp === net.pullDown) throw new Error(net.pullUp ? 'output shorted: both networks conduct' : 'output floating: neither network conducts');
  return net.pullUp ? 1 : 0;
}
export const INVERTER_TABLE = [[0, 1], [1, 0]];
export const NAND_TABLE = [[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]];
