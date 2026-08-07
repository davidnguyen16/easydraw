'use client';

import type { DragEvent } from 'react';
import { dndState } from '@/lib/flow/dnd';
import type { NodeShape, PaletteGroupId } from '@/lib/flow/nodes/registry';

interface PaletteGroup {
  id: PaletteGroupId;
  heading: string;
  shapes: readonly NodeShape[];
  expanded: boolean;
}

interface Props {
  heading: string;
  shapes: readonly NodeShape[];
  groups?: readonly PaletteGroup[];
  expanded: boolean;
  onToggle: () => void;
  onGroupToggle: (group: PaletteGroupId) => void;
}

// Stash the dragged shape id in the shared DnD state so Flow.onDrop can look it
// up in the registry. Icons stay decoupled from the drop logic.
function onDragStart(event: DragEvent, shapeId: string) {
  if (!event.dataTransfer) return;
  dndState.current = shapeId;
  event.dataTransfer.effectAllowed = 'move';
}

function ShapeGrid({ items }: { items: readonly NodeShape[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-2">
      {items.map((shape) => {
        const Icon = shape.icon;
        const iconProps = shape.paletteIconProps ?? {};
        return (
          <button
            key={shape.id}
            type="button"
            className="flex aspect-square cursor-grab items-center justify-center rounded-lg border border-[#e8e2d3] bg-white p-0 text-mq-red transition-[border-color,box-shadow] duration-150 hover:border-mq-red hover:shadow-[0_1px_4px_rgba(166,25,46,0.15)] active:cursor-grabbing"
            aria-label={shape.label}
            title={shape.label}
            draggable
            onDragStart={(event) => onDragStart(event, shape.id)}
          >
            <Icon {...iconProps} />
          </button>
        );
      })}
    </div>
  );
}

export default function NodeContainer({ heading, shapes, groups = [], expanded, onToggle, onGroupToggle }: Props) {
  return (
    <section className="flex flex-col gap-[0.6rem]">
      <button
        type="button"
        className="group flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-0 py-[0.2rem] text-left text-mq-maroon focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mq-red"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <svg
          className={`size-3.5 shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
        <span className="text-[0.72rem] font-bold tracking-[0.06em] uppercase group-hover:underline">{heading}</span>
      </button>

      {expanded ? (
        groups.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-3">
            {groups.map((group) => (
              <section key={group.id} className="flex min-w-0 flex-col gap-2">
                <button
                  type="button"
                  className="group flex w-full min-w-0 cursor-pointer items-center gap-1.5 border-none bg-transparent py-[0.15rem] pr-0 pl-2 text-left text-ink-soft focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mq-red"
                  aria-expanded={group.expanded}
                  onClick={() => onGroupToggle(group.id)}
                >
                  <svg
                    className={`size-3 shrink-0 transition-transform duration-150 ${group.expanded ? 'rotate-90' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                  <span className="min-w-0 text-[0.75rem] leading-snug font-semibold group-hover:underline">{group.heading}</span>
                </button>

                {group.expanded ? (
                  group.shapes.length === 0 ? (
                    <p className="m-0 pl-5 text-[0.75rem] text-ink-muted italic">No shapes yet.</p>
                  ) : (
                    <ShapeGrid items={group.shapes} />
                  )
                ) : null}
              </section>
            ))}
          </div>
        ) : shapes.length === 0 ? (
          <p className="m-0 pl-[1.4rem] text-[0.75rem] text-ink-muted italic">No shapes yet.</p>
        ) : (
          <ShapeGrid items={shapes} />
        )
      ) : null}
    </section>
  );
}
