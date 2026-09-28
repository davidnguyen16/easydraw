import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { previewEdgeAppearance, previewEdgePath } from './preview-edge';

const endpoints = { sourceX: 0, sourceY: 0, targetX: 200, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left };

describe('read-only preview edge routing', () => {
  it('preserves straight, curved, and orthogonal routes', () => {
    const straight = previewEdgePath(endpoints, 'straight')[0];
    const curved = previewEdgePath(endpoints, 'curved')[0];
    const orthogonal = previewEdgePath(endpoints, 'orthogonal')[0];
    expect(straight).toBe('M 0,0L 200,100');
    expect(curved).toContain('C');
    expect(orthogonal).toContain('L');
    expect(orthogonal).not.toBe(straight);
    expect(previewEdgePath(endpoints, undefined)[0]).toBe(orthogonal);
  });

  it('preserves dash patterns and rejects arbitrary paint strings', () => {
    expect(previewEdgeAppearance({ lineStyle: 'dashed', strokeColor: '#123456', strokeWidth: 2 }))
      .toMatchObject({ strokeDasharray: '8 5', stroke: '#123456', strokeWidth: 2 });
    expect(previewEdgeAppearance({ dash: 'dotted' }).strokeDasharray).toBe('1 5');
    expect(previewEdgeAppearance({ strokeColor: 'url(https://example.invalid)', strokeWidth: Infinity }))
      .toMatchObject({ stroke: '#777168', strokeWidth: 1.5 });
  });
});
