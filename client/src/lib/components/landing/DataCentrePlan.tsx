'use client';

import { useId } from 'react';
import type { Node } from '@xyflow/react';
import { LANDING_EQUIPMENT, LANDING_PAGE, LANDING_SCENE, LANDING_TITLE } from './landing-data';
import styles from './HomeExperience.module.css';

const MQ_RED = 'var(--color-mq-red, #a6192e)';
const number = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;

function bounds(node: Node) {
  const width = number(node.width, number(node.style?.width, 100));
  const height = number(node.height, number(node.style?.height, 100));
  return { x: node.position.x, y: node.position.y, width, height };
}

const equipmentById = new Map(LANDING_EQUIPMENT.map((node) => [node.id, node]));
const originalEdgeById = new Map(LANDING_PAGE.edges.map((edge) => [edge.id, edge]));
const orderedNodes = LANDING_PAGE.nodes.map((node, order) => ({ node, order }))
  .sort((a, b) => number(a.node.zIndex) - number(b.node.zIndex) || a.order - b.order)
  .map(({ node }) => node);
const originalBounds = orderedNodes.map(bounds);
const left = Math.min(...originalBounds.map((node) => node.x)) - 45;
const top = Math.min(...originalBounds.map((node) => node.y)) - 45;
const right = Math.max(...originalBounds.map((node) => node.x + node.width)) + 45;
const bottom = Math.max(...originalBounds.map((node) => node.y + node.height)) + 45;

/** A top-down projection of the complete Dashboard sample, in its original
 * pixel coordinates. No miniature graph, editor store, or API writes. */
export default function DataCentrePlan({ selectedId, onSelect, decorative = false }: {
  selectedId: string | null; onSelect?: (id: string | null) => void; decorative?: boolean;
}) {
  const titleId = useId();

  function renderNode(node: Node) {
    const { x, y, width, height } = bounds(node);
    const data = node.data;
    const equipment = equipmentById.get(node.id);
    const isText = node.type === 'TextNode';
    const interactive = !decorative && Boolean(equipment) && Boolean(onSelect);
    const label = text(data.label);
    const fontSize = number(data.fontSize, 18);
    const leftAligned = data.textAlign === 'left';
    const rightAligned = data.textAlign === 'right';
    const lines = label.split('\n');
    const selected = selectedId === node.id;
    return <g key={node.id} transform={`translate(${x} ${y})`}
      data-node-id={node.id} data-node-type={node.type}
      data-node-role={equipment ? 'equipment' : isText ? 'label' : 'structure'}
      data-node-x={x} data-node-y={y} data-node-width={width} data-node-height={height}
      className={interactive ? styles.planNode : undefined}
      role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={interactive ? `Inspect ${equipment?.label || node.id}` : undefined}
      onClick={interactive ? () => onSelect?.(node.id) : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); onSelect?.(node.id);
        }
      } : undefined}>
      {!decorative && <title>{label || node.id}</title>}
      {!isText && <rect width={width} height={height} fill={text(data.fillColor, '#fff')}
        stroke={text(data.borderColor, 'none')} strokeWidth={number(data.borderWidth)} />}
      {label && <text x={leftAligned ? 8 : rightAligned ? width - 8 : width / 2}
        y={height / 2 - (lines.length - 1) * fontSize * 0.6}
        textAnchor={leftAligned ? 'start' : rightAligned ? 'end' : 'middle'} dominantBaseline="central"
        fontSize={fontSize} fontWeight={data.bold ? 700 : 400} fill={text(data.textColor, '#22334a')}
        pointerEvents="none">
        {lines.map((line, index) => <tspan key={index} x={leftAligned ? 8 : rightAligned ? width - 8 : width / 2}
          dy={index ? fontSize * 1.2 : 0}>{line}</tspan>)}
      </text>}
      {selected && <rect x={-3} y={-3} width={width + 6} height={height + 6} rx="2" fill="none"
        stroke={MQ_RED} strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
    </g>;
  }

  return <svg viewBox={`${left} ${top} ${right - left} ${bottom - top}`} className={styles.plan}
    aria-hidden={decorative || undefined} role={decorative ? undefined : 'group'}
    aria-label={decorative ? undefined : 'Data centre 2D floor plan'} aria-describedby={decorative ? undefined : titleId}
    data-testid={decorative ? undefined : 'landing-data-centre-plan'} data-source-title={LANDING_TITLE}
    data-node-count={LANDING_PAGE.nodes.length} data-edge-count={LANDING_SCENE.edges.length}>
    <title id={titleId}>{LANDING_TITLE}</title>
    {orderedNodes.filter((node) => number(node.zIndex) < 0).map(renderNode)}
    {LANDING_SCENE.edges.map((edge) => <path key={edge.id} data-edge-id={edge.id}
      data-edge-source={originalEdgeById.get(edge.id)?.source} data-edge-target={originalEdgeById.get(edge.id)?.target}
      d={edge.points.map((point, index) => `${index ? 'L' : 'M'}${(point[0] + LANDING_SCENE.origin[0]) * 100} ${(point[2] + LANDING_SCENE.origin[2]) * 100}`).join(' ')}
      fill="none" stroke={edge.color} strokeWidth={edge.width} strokeLinejoin="round" strokeLinecap="round"
      strokeDasharray={edge.dashed ? '8 6' : undefined} />)}
    {orderedNodes.filter((node) => number(node.zIndex) >= 0).map(renderNode)}
  </svg>;
}
