/**
 * Visio arrowhead indexes (`BeginArrow` / `EndArrow`, 0–45) → EasyDraw
 * markers. The index meanings are the ones Visio's Line dialog lists, as
 * catalogued by libvisio's marker renderer; where EasyDraw has no twin the
 * nearest silhouette is used.
 */
import type { MarkerKind } from '../document.js';

const ARROWS: Record<number, MarkerKind> = {
  0: 'none',
  1: 'arrow', 3: 'arrow', 12: 'arrow', 9: 'bar',
  2: 'triangle-sharp', 4: 'triangle', 5: 'triangle', 6: 'triangle', 8: 'triangle', 13: 'triangle',
  7: 'triangle-open', 14: 'triangle-open', 15: 'triangle-open', 16: 'triangle-open', 17: 'triangle-open', 18: 'triangle-open', 19: 'triangle-open',
  10: 'circle', 41: 'circle', 42: 'circle', 20: 'circle-open',
  11: 'square', 21: 'square-open', 22: 'diamond-open', 23: 'slash',
  24: 'bar', 25: 'bar-double', 26: 'bar-double', 27: 'crowfoot', 28: 'bar-crowfoot', 29: 'circle-crowfoot', 30: 'circle-bar',
  31: 'circle-open', 32: 'circle-open', 33: 'circle-open', 34: 'circle-open',
  35: 'bar-circle', 36: 'bar-double-circle', 37: 'bar-triple-circle', 38: 'diamond-circle',
  39: 'triangle-double', 40: 'triangle-open-double', 43: 'triangle-double', 44: 'triangle-double', 45: 'triangle-double',
};

export function markerOf(index: number | undefined): MarkerKind {
  if (index === undefined || !Number.isFinite(index)) return 'none';
  return ARROWS[Math.round(index)] ?? 'triangle';
}
