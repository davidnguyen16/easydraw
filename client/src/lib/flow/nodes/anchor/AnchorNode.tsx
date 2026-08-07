'use client';

/**
 * Connection anchor host — see anchor.ts for the why.
 *
 * Renders NOTHING visible. It exists only so a floating edge endpoint has a
 * real node + handle to resolve its position from (xyflow edges must point at
 * a real node). The visible endpoint dot lives on the EDGE (EndpointHandle),
 * shown only on hover/selection. The handle stays in the DOM (transparent) so
 * xyflow can measure its bounds; pointer-events are stripped in xy-theme.css.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ANCHOR_HANDLE_ID } from './anchor';

export default function AnchorNode({ selected }: NodeProps) {
  return (
    <div className={`relative h-full w-full ${selected ? 'selected' : ''}`}>
      <Handle
        type="source"
        position={Position.Top}
        id={ANCHOR_HANDLE_ID}
        className="anchor-handle"
        isConnectable={false}
      />
    </div>
  );
}
