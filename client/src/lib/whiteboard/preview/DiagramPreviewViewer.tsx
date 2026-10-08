'use client';

import { Component, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Box, LoaderCircle, Square } from 'lucide-react';
import type { DiagramCamera3D, PagedDiagramData } from '@easydraw/diagram-schema';
import DiagramPreviewCanvas from './DiagramPreviewCanvas';
import type { PreviewCatalog } from './preview-catalog';

const DiagramPreview3D = dynamic(() => import('./DiagramPreview3D'), {
  ssr: false,
  loading: () => <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-ink-muted">
    <LoaderCircle size={18} className="animate-spin text-mq-red" />Loading 3D preview…
  </div>,
});

class Preview3DBoundary extends Component<{ children: ReactNode; onReturnTo2D: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-sm text-ink-muted">
      <p>3D preview could not load. Your preview and drawing are unchanged.</p>
      <button type="button" onClick={this.props.onReturnTo2D} className="rounded-lg border border-line bg-white px-3 py-2 text-mq-red">Return to 2D</button>
    </div> : this.props.children;
  }
}

/** The result key is owned by the workspace. Camera and view are local UI only;
 * the 2D viewport survives toggles, but hidden 3D graphics are fully unmounted. */
export default function DiagramPreviewViewer({ document, active = true, catalog = 'ai', initialMode = '2D' }: {
  document: PagedDiagramData; active?: boolean; catalog?: PreviewCatalog; initialMode?: '2D' | '3D';
}) {
  const page = document.pages.find((item) => item.id === document.activePageId) ?? document.pages[0];
  const [mode, setMode] = useState<'2D' | '3D'>(initialMode);
  // Keep a prepared sample's teaching angle. The standalone scene fits that
  // direction to this panel instead of reusing the full editor's distance.
  const [camera, setCamera] = useState<DiagramCamera3D | undefined>(
    catalog === 'built-in' ? page?.view3d?.camera : undefined,
  );
  const [orientation, setOrientation] = useState<'floor' | 'upright'>(page?.view3d?.orientation ?? 'upright');
  const [showGrid, setShowGrid] = useState(page?.view3d?.showGrid ?? false);
  const teachingPreview = catalog === 'built-in' && initialMode === '3D';
  const returnTo2D = () => setMode('2D');
  return <div data-testid="diagram-preview-viewer" data-preview-view={mode}
    className="flex min-w-0 flex-1 flex-col">
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line-soft bg-white px-3 py-2">
      <span className="text-[10px] text-ink-muted">Same diagram in 2D and 3D</span>
      <div role="group" aria-label="Preview dimension" className="flex rounded-lg border border-line-soft bg-[#faf8f3] p-0.5">
        {(['2D', '3D'] as const).map((value) => <button key={value} type="button" aria-label={`${value} preview`}
          aria-pressed={mode === value} onClick={() => setMode(value)}
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-mq-red ${mode === value ? 'bg-white text-mq-red shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
          {value === '2D' ? <Square size={13} /> : <Box size={13} />}{value}
        </button>)}
      </div>
    </div>
    <div className={`relative flex-1 ${mode === '3D'
      ? teachingPreview ? 'min-h-[520px]' : 'min-h-[360px]'
      : 'min-h-[260px]'}`}>
      <div className={`absolute inset-0 ${mode === '2D' ? '' : 'invisible pointer-events-none'}`} aria-hidden={mode !== '2D'} inert={mode !== '2D'}>
        <DiagramPreviewCanvas document={document} catalog={catalog} />
      </div>
      {mode === '3D' && active && <Preview3DBoundary onReturnTo2D={returnTo2D}>
        <DiagramPreview3D document={document} catalog={catalog} camera={camera} onCameraChange={setCamera} onReturnTo2D={returnTo2D}
          orientation={orientation} onOrientationChange={(value) => { setOrientation(value); setCamera(undefined); }}
          showGrid={showGrid} onShowGridChange={setShowGrid} />
      </Preview3DBoundary>}
    </div>
    {mode === '3D' && <p className="shrink-0 border-t border-line-soft bg-white px-3 py-2 text-[10px] leading-4 text-ink-muted">
      {catalog === 'built-in'
        ? 'Read-only preview. Create diagram to edit objects and labels.'
        : 'Read-only. Supported vectors have depth; images and complex fallback artwork stay flat. No hidden detail is inferred.'}
    </p>}
  </div>;
}
