'use client';

import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { useEditorStore } from '@/lib/stores/editor.store';
import { toFiniteRotation } from '../style-utils';
import SourceImageArtwork from './SourceImageArtwork';

const CONNECTION_CLASS = 'shape-conn pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-[.selected]:pointer-events-auto group-[.selected]:opacity-100';

export default function SourceImageNode({ data, selected, isConnectable }: NodeProps) {
  const locked = useEditorStore((state) => state.locked || state.presenting);
  return (
    <div className={`group relative h-full w-full ${selected ? 'selected' : ''}`}
      style={{ transform: `rotate(${toFiniteRotation(data.rotation)}deg)`, transformOrigin: 'center' }}>
      <SourceImageArtwork data={data} className="pointer-events-none group-[.selected]:outline group-[.selected]:outline-2 group-[.selected]:outline-mq-red" />
      <NodeResizer isVisible={Boolean(selected && !locked)} minWidth={16} minHeight={16}
        handleClassName="shape-resize-anchor" lineClassName="shape-resize-line" />
      {([['top', Position.Top], ['right', Position.Right], ['bottom', Position.Bottom], ['left', Position.Left]] as const)
        .map(([id, position]) => <Handle key={id} id={id} type="source" position={position}
          isConnectable={isConnectable && !locked} className={CONNECTION_CLASS} />)}
    </div>
  );
}
