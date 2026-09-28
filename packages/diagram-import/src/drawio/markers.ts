/**
 * draw.io arrowheads (`startArrow` / `endArrow`) → EasyDraw markers. draw.io
 * pairs each name with a `startFill` / `endFill` flag (default filled), so a
 * `block` is a filled triangle unless `endFill=0` makes it an outline.
 */
import type { MarkerKind } from '../document.js';
import type { DrawioStyle } from './style.js';

const FILLED: Record<string, MarkerKind> = {
  classic: 'triangle', classicThin: 'triangle-sharp', block: 'triangle', blockThin: 'triangle-sharp',
  open: 'arrow', openThin: 'arrow', openAsync: 'half-arrow-up', async: 'half-arrow-up',
  oval: 'circle', diamond: 'diamond', diamondThin: 'diamond', box: 'square', halfCircle: 'circle-open',
  dash: 'bar', cross: 'bar', circlePlus: 'circle-cross', circle: 'circle-open', baseDash: 'bar',
  ERone: 'bar', ERmandOne: 'bar-double', ERmany: 'crowfoot', ERoneToMany: 'bar-crowfoot',
  ERzeroToOne: 'circle-bar', ERzeroToMany: 'circle-crowfoot', doubleBlock: 'triangle-double',
  manyOptional: 'circle-crowfoot', none: 'none',
};

const OUTLINE: Partial<Record<string, MarkerKind>> = {
  classic: 'triangle-open', classicThin: 'triangle-open', block: 'triangle-open', blockThin: 'triangle-open',
  oval: 'circle-open', diamond: 'diamond-open', diamondThin: 'diamond-open-small', box: 'square-open',
  doubleBlock: 'triangle-open-double',
};

/** draw.io's implicit defaults: an arrow at the target, nothing at the source. */
export function markersOf(style: DrawioStyle): { markerStart: MarkerKind; markerEnd: MarkerKind } {
  return {
    markerStart: resolve(style.get('startArrow') ?? 'none', style.get('startFill')),
    markerEnd: resolve(style.get('endArrow') ?? 'classic', style.get('endFill')),
  };
}

function resolve(name: string, fill: string | undefined): MarkerKind {
  if (fill === '0') return OUTLINE[name] ?? FILLED[name] ?? 'triangle-open';
  return FILLED[name] ?? 'triangle';
}
