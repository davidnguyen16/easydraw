'use client';

import { useNodes } from '@xyflow/react';
import {
  Trash2,
  Scissors,
  Copy,
  CopyPlus,
  Lock,
  LockOpen,
  ChevronsUp,
  ChevronsDown,
  ChevronUp,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { useEditor } from '@/lib/flow/EditorContext';

// Right-click menu on a node. Actions come from the editor context (shared with
// toolbar / style panel); Flow selects the right-clicked node first so the
// selection-based actions target it. (Port of ContextMenu.svelte.)
interface Props {
  id: string;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  onClick: () => void;
}

const ITEM_CLASS =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left ' +
  'text-[0.85rem] transition-colors duration-100';

export default function ContextMenu({ id, top, left, right, bottom, onClick }: Props) {
  const editor = useEditor();
  const nodes = useNodes();
  const locked = Boolean((nodes.find((n) => n.id === id)?.data as { locked?: boolean })?.locked);

  const groups: { label: string; Icon: LucideIcon; run: () => void; danger?: boolean }[][] = [
    [{ label: 'Delete', Icon: Trash2, run: () => editor.deleteSelected(), danger: true }],
    [
      { label: 'Cut', Icon: Scissors, run: () => editor.cut() },
      { label: 'Copy', Icon: Copy, run: () => editor.copy() },
      { label: 'Duplicate', Icon: CopyPlus, run: () => editor.duplicate() },
    ],
    [{ label: 'Lock', Icon: Lock, run: () => editor.toggleNodeLock(id) }],
    [
      { label: 'To Front', Icon: ChevronsUp, run: () => editor.bringToFront() },
      { label: 'To Back', Icon: ChevronsDown, run: () => editor.sendToBack() },
      { label: 'Bring Forward', Icon: ChevronUp, run: () => editor.bringForward() },
      { label: 'Send Backward', Icon: ChevronDown, run: () => editor.sendBackward() },
    ],
  ];

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="menu"
      tabIndex={-1}
      style={{ top, left, right, bottom }}
      className="absolute z-10 min-w-[188px] rounded-[10px] border border-line bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {locked ? (
        <button
          type="button"
          className={`${ITEM_CLASS} text-ink-soft hover:bg-[#edebe5] hover:text-ink`}
          onClick={() => editor.toggleNodeLock(id)}
        >
          <LockOpen size={16} strokeWidth={1.75} />
          Unlock
        </button>
      ) : (
        groups.map((group, i) => (
          <div key={i}>
            {i > 0 && <div className="my-1 h-px bg-line" />}
            {group.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`${ITEM_CLASS} ${
                  item.danger
                    ? 'text-[#e5484d] hover:bg-[#fdecec]'
                    : 'text-ink-soft hover:bg-[#edebe5] hover:text-ink'
                }`}
                onClick={item.run}
              >
                <item.Icon size={16} strokeWidth={1.75} />
                {item.label}
              </button>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
