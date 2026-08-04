'use client';

import { getNetworkDefinition } from './definitions';
import { NETWORK_SYMBOLS, type NetworkPaintRole, type NetworkPrimitive } from './symbols';

interface Props {
  id: string;
  mode?: 'canvas' | 'palette';
  fillColor?: string;
  strokeColor?: string;
  accentColor?: string;
  strokeScale?: number;
  opacity?: number;
  className?: string;
}

// Renders a network symbol (router, switch, firewall, …) from the shared
// primitive catalog. Ported 1:1 from NetworkGlyph.svelte — paint roles map
// styling fields (fill/accent/muted/ink) onto the user's colours.
export default function NetworkGlyph({
  id,
  mode = 'canvas',
  fillColor = '#ffffff',
  strokeColor = '#2c2c2a',
  accentColor = '#a6192e',
  strokeScale = 1,
  opacity = 1,
  className = '',
}: Props) {
  const definition = getNetworkDefinition(id);
  const primitives: readonly NetworkPrimitive[] = definition
    ? NETWORK_SYMBOLS[definition.symbol]
    : [];
  const preserveAspectRatio =
    definition?.kind === 'container' && mode === 'canvas' ? 'none' : 'xMidYMid meet';
  const viewBox = definition?.viewBox ?? '0 0 100 80';

  function paint(role: NetworkPaintRole | undefined): string {
    switch (role) {
      case 'none':
        return 'none';
      case 'surface':
        return fillColor;
      case 'accent':
        return accentColor;
      case 'accent-soft':
        return `color-mix(in srgb, ${accentColor} 11%, ${fillColor})`;
      case 'muted':
        return `color-mix(in srgb, ${strokeColor} 48%, ${fillColor})`;
      case 'ink':
      default:
        return strokeColor;
    }
  }

  function scaledStrokeWidth(width: number | undefined): number | undefined {
    if (width === undefined) return undefined;
    const safeScale = Number.isFinite(strokeScale)
      ? Math.max(0, Math.min(10 / 1.8, strokeScale))
      : 1;
    return width * safeScale;
  }

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      className={className}
      style={{ opacity }}
      aria-hidden="true"
      focusable="false"
    >
      {primitives.map((primitive, index) => {
        if (mode === 'palette' && primitive.paletteHidden) return null;
        const fill = paint(primitive.fill);
        const stroke = paint(primitive.stroke);
        const width = scaledStrokeWidth(primitive.strokeWidth);

        switch (primitive.kind) {
          case 'path':
            return (
              <path
                key={index}
                d={primitive.d}
                fill={fill}
                stroke={stroke}
                strokeWidth={width}
                strokeDasharray={primitive.dash}
                strokeLinecap={primitive.lineCap}
                strokeLinejoin={primitive.lineJoin}
                opacity={primitive.opacity}
                vectorEffect="non-scaling-stroke"
              />
            );
          case 'rect':
            return (
              <rect
                key={index}
                x={primitive.x}
                y={primitive.y}
                width={primitive.width}
                height={primitive.height}
                rx={primitive.rx}
                fill={fill}
                stroke={stroke}
                strokeWidth={width}
                strokeDasharray={primitive.dash}
                strokeLinecap={primitive.lineCap}
                strokeLinejoin={primitive.lineJoin}
                opacity={primitive.opacity}
                vectorEffect="non-scaling-stroke"
              />
            );
          case 'circle':
            return (
              <circle
                key={index}
                cx={primitive.cx}
                cy={primitive.cy}
                r={primitive.r}
                fill={fill}
                stroke={stroke}
                strokeWidth={width}
                strokeDasharray={primitive.dash}
                opacity={primitive.opacity}
                vectorEffect="non-scaling-stroke"
              />
            );
          case 'ellipse':
            return (
              <ellipse
                key={index}
                cx={primitive.cx}
                cy={primitive.cy}
                rx={primitive.rx}
                ry={primitive.ry}
                fill={fill}
                stroke={stroke}
                strokeWidth={width}
                strokeDasharray={primitive.dash}
                opacity={primitive.opacity}
                vectorEffect="non-scaling-stroke"
              />
            );
          case 'line':
            return (
              <line
                key={index}
                x1={primitive.x1}
                y1={primitive.y1}
                x2={primitive.x2}
                y2={primitive.y2}
                stroke={stroke}
                strokeWidth={width}
                strokeDasharray={primitive.dash}
                strokeLinecap={primitive.lineCap}
                opacity={primitive.opacity}
                vectorEffect="non-scaling-stroke"
              />
            );
          case 'polyline':
            return (
              <polyline
                key={index}
                points={primitive.points}
                fill={fill}
                stroke={stroke}
                strokeWidth={width}
                strokeDasharray={primitive.dash}
                strokeLinecap={primitive.lineCap}
                strokeLinejoin={primitive.lineJoin}
                opacity={primitive.opacity}
                vectorEffect="non-scaling-stroke"
              />
            );
          case 'polygon':
            return (
              <polygon
                key={index}
                points={primitive.points}
                fill={fill}
                stroke={stroke}
                strokeWidth={width}
                strokeDasharray={primitive.dash}
                strokeLinejoin={primitive.lineJoin}
                opacity={primitive.opacity}
                vectorEffect="non-scaling-stroke"
              />
            );
          default:
            return (
              <text
                key={index}
                x={primitive.x}
                y={primitive.y}
                fill={fill}
                fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                fontSize={primitive.fontSize ?? 12}
                fontWeight={primitive.fontWeight ?? 700}
                textAnchor="middle"
                dominantBaseline="middle"
                opacity={primitive.opacity}
              >
                {primitive.text}
              </text>
            );
        }
      })}
    </svg>
  );
}
