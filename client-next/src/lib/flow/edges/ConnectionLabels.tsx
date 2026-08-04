'use client';

import type { CSSProperties } from 'react';
import { EdgeLabelRenderer } from '@xyflow/react';
import type { ConnectionLabel, Point } from './types';
import type { ConnectionLabelEditor } from './connection-label-editor';

interface Props {
  labels: ConnectionLabel[];
  selected?: boolean;
  labelStyle: CSSProperties;
  pointAtT: (t: number) => Point;
  editor: ConnectionLabelEditor;
}

// Positions a portaled HTML chip at a flow point (the Svelte EdgeLabel's
// transparent host, minus its default padding/background).
function hostStyle(point: Point): CSSProperties {
  return {
    position: 'absolute',
    transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`,
    pointerEvents: 'all',
  };
}

export default function ConnectionLabels({
  labels,
  selected = false,
  labelStyle,
  pointAtT,
  editor,
}: Props) {
  return (
    <EdgeLabelRenderer>
      {labels.map((label) => {
        if (label.id === editor.editingId) return null;
        const point = pointAtT(label.t);
        return (
          <div key={label.id} style={hostStyle(point)} className="conn-label-host">
            <div
              className={`nodrag nopan cursor-text rounded-[2px] px-1.5 py-0.5 text-[13px] font-semibold
                leading-[1.25] whitespace-nowrap text-[#1f1d1a] select-none
                ${selected ? 'bg-[#b3d4f5]' : 'bg-white'}`}
              role="button"
              tabIndex={-1}
              aria-label="Connection label, double-click to edit"
              onDoubleClick={(event) => {
                event.stopPropagation();
                editor.startEditing(label.id);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              style={labelStyle}
            >
              {label.text}
            </div>
          </div>
        );
      })}

      {editor.editingId !== null ? (
        <div style={hostStyle(pointAtT(editor.editingT))} className="conn-label-host">
          <div
            className="nodrag nopan nowheel min-w-1.5 cursor-text rounded-[2px] bg-[#b3d4f5] px-1.5 py-0.5
              text-[13px] font-semibold leading-[1.25] whitespace-nowrap text-[#1f1d1a] outline-none
              select-text [caret-color:#1f1d1a]"
            role="textbox"
            tabIndex={0}
            aria-label="Edit connection label"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            ref={editor.editorRef}
            onInput={editor.onEditorInput}
            onKeyDown={editor.onEditorKeydown}
            onBlur={editor.onEditorBlur}
            onPointerDown={(event) => event.stopPropagation()}
            style={labelStyle}
          />
        </div>
      ) : null}
    </EdgeLabelRenderer>
  );
}
