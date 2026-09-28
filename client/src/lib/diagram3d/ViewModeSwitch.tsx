'use client';

import { Box, Square } from 'lucide-react';
import type { DiagramViewMode } from './types';

export default function ViewModeSwitch({
  value,
  onChange,
}: {
  value: DiagramViewMode;
  onChange: (mode: DiagramViewMode) => void;
}) {
  return (
    <div role="group" aria-label="Diagram view" className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-line-soft bg-[#f6f5f1] p-0.5">
      {(['2d', '3d'] as const).map((mode) => {
        const Icon = mode === '2d' ? Square : Box;
        return (
          <button
            key={mode}
            type="button"
            aria-label={`${mode.toUpperCase()} view`}
            aria-pressed={value === mode}
            title={mode === '2d' ? 'Edit the original 2D diagram' : 'Explore this diagram in 3D space'}
            onClick={() => onChange(mode)}
            className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a6192e] ${value === mode ? 'bg-white text-[#a6192e] shadow-sm' : 'text-[#66675f] hover:bg-white'}`}
          >
            <Icon size={14} aria-hidden="true" />
            {mode.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
