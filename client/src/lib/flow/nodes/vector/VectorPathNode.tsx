'use client';

import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { useEditorStore } from '@/lib/stores/editor.store';
import { toFiniteRotation } from '../style-utils';
import VectorArtwork from './VectorArtwork';

const CONNECTION_CLASS = 'shape-conn pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-[.selected]:pointer-events-auto group-[.selected]:opacity-100';

/** Generic imported vector: move, resize, rotate and style the whole object.
 * Its semantic label is not painted a second time over recognized text. */
export default function VectorPathNode({ data, width, height, selected, isConnectable }: NodeProps) {
  const locked = useEditorStore((state) => state.locked || state.presenting);
  return (
    <div className={`group relative h-full w-full ${selected ? 'selected' : ''}`}
      style={{ transform: `rotate(${toFiniteRotation(data.rotation)}deg)`, transformOrigin: 'center' }}>
      <VectorArtwork data={data} width={width} height={height}
        className="pointer-events-none group-[.selected]:outline group-[.selected]:outline-2 group-[.selected]:outline-mq-red" />
      <NodeResizer isVisible={Boolean(selected && !locked)} minWidth={4} minHeight={4}
        handleClassName="shape-resize-anchor" lineClassName="shape-resize-line" />
      {([['top', Position.Top], ['right', Position.Right], ['bottom', Position.Bottom], ['left', Position.Left]] as const)
        .map(([id, position]) => <Handle key={id} id={id} type="source" position={position}
          isConnectable={isConnectable && !locked} className={CONNECTION_CLASS} />)}
    </div>
  );
}
