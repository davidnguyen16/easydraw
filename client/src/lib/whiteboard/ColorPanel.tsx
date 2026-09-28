'use client';

import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import ColorField from '@/lib/components/ColorField';
import { PALETTE } from './engine/types';
import { useWhiteboard } from './whiteboard.store';

/**
 * Floating colour panel on the right, where the diagram editor keeps its
 * style panel. Two colours as in MS Paint: line (left button) and fill
 * (right button). Left-click a swatch to set the active one; right-click
 * sets the other, so both can be picked without switching.
 */
export default function ColorPanel({ visible = true }: { visible?: boolean }) {
  const engine = useWhiteboard((s) => s.engine);
  const options = useWhiteboard((s) => s.options);
  const [target, setTarget] = useState<'line' | 'fill'>('line');
  const set = (which: 'line' | 'fill', hex: string) => {
    const color = hex.toLowerCase();
    engine?.setOptions(which === 'line' ? { lineColor: color } : { fillColor: color });
  };
  const current = target === 'line' ? options.lineColor : options.fillColor;

  return (
    <aside
      id="whiteboard-colors-panel"
      hidden={!visible}
      className={`absolute top-4 right-4 z-30 ${visible ? 'flex' : 'hidden'} w-[232px] flex-col gap-4 rounded-xl border border-line bg-panel p-4 font-sans shadow-[0_12px_28px_rgba(0,0,0,0.08)]`}
      aria-label="Colors"
    >
      <div className="flex items-center gap-2">
        <div className="relative h-11 w-14 shrink-0">
          <button
            type="button"
            title="Fill colour (right button)"
            aria-label="Fill colour"
            aria-pressed={target === 'fill'}
            onClick={() => setTarget('fill')}
            className={`absolute right-0 bottom-0 h-8 w-8 rounded-md border-2 ${target === 'fill' ? 'border-mq-red' : 'border-white'} shadow-sm`}
            style={{ backgroundColor: options.fillColor }}
          />
          <button
            type="button"
            title="Line colour (left button)"
            aria-label="Line colour"
            aria-pressed={target === 'line'}
            onClick={() => setTarget('line')}
            className={`absolute top-0 left-0 h-8 w-8 rounded-md border-2 ${target === 'line' ? 'border-mq-red' : 'border-white'} shadow-sm`}
            style={{ backgroundColor: options.lineColor }}
          />
        </div>
        <div className="min-w-0 flex-1 text-[0.8rem] leading-snug text-ink-soft">
          <p className="font-semibold text-ink">{target === 'line' ? 'Line colour' : 'Fill colour'}</p>
          <p className="text-ink-muted">{target === 'line' ? 'Left button · outlines, pencil, text' : 'Right button · fills, eraser'}</p>
        </div>
        <button
          type="button"
          title="Switch line and fill colours (X)"
          aria-label="Switch line and fill colours"
          onClick={() => engine?.swapColors()}
          className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-toolbar-text hover:bg-surface-hover hover:text-ink"
        >
          <ArrowLeftRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-6 gap-1.5" role="listbox" aria-label="Palette">
        {PALETTE.map((swatch) => {
          const active = swatch.hex === current;
          return (
            <button
              key={swatch.hex}
              type="button"
              role="option"
              aria-selected={active}
              title={swatch.name}
              aria-label={swatch.name}
              onClick={() => set(target, swatch.hex)}
              onContextMenu={(e) => {
                e.preventDefault();
                set(target === 'line' ? 'fill' : 'line', swatch.hex);
              }}
              className={`aspect-square rounded-md border ${active ? 'border-mq-red ring-2 ring-mq-red/30' : 'border-black/10'} transition-transform hover:scale-105`}
              style={{ backgroundColor: swatch.hex }}
            />
          );
        })}
      </div>

      <ColorField label={target === 'line' ? 'Custom line colour' : 'Custom fill colour'} value={current} onChange={(hex) => set(target, hex)} />
    </aside>
  );
}
