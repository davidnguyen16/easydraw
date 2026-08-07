'use client';

/**
 * Draggable endpoint handle on a connection (draw.io style). Two concentric
 * circles: a larger transparent hit circle + a small visible dot whose look
 * encodes attachment (solid = pinned to a node, dashed white = floating).
 * Purely presentational + a pointerdown hook — the drag lives in
 * ConnectionEdge. Ported 1:1 from EndpointHandle.svelte.
 */
interface Props {
  x: number;
  y: number;
  floating?: boolean;
  hit?: number;
  onPointerDown?: (event: PointerEvent) => void;
}

const COLOR = '#a6192e';
const R = 5; // visible dot radius

export default function EndpointHandle({ x, y, floating = false, hit = 10, onPointerDown }: Props) {
  return (
    <g
      className="cursor-move [pointer-events:all] [&_*]:cursor-move [&_*]:[pointer-events:all]"
      onPointerDown={(e) => onPointerDown?.(e.nativeEvent)}
      role="presentation"
    >
      <circle cx={x} cy={y} r={hit} fill="transparent" />
      <circle
        cx={x}
        cy={y}
        r={R}
        fill={floating ? '#ffffff' : COLOR}
        stroke={floating ? COLOR : '#ffffff'}
        strokeWidth={1.5}
        strokeDasharray={floating ? '2 2' : undefined}
      />
    </g>
  );
}
