'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, Check, FolderOpen, X } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth.store';
import { objectLibraryApi, useObjectLibrary, type Object3DTemplate } from '@/lib/diagram3d/object-library';
import { pickObjectFolder } from '@/lib/diagram3d/object-files';
import { parseObjectFolderFiles, type ObjectFolderCandidate } from '@/lib/diagram3d/object-folder-import';
import { findDuplicate } from '@/lib/diagram3d/duplicate-object';
import { renderObjectThumbnail } from '@/lib/diagram3d/object-thumbnail';
import { buildDiagramScene } from '@/lib/diagram3d/scene-model';
import PlanGlyph from '@/lib/diagram3d/PlanGlyph';
import type { LibrarySection } from './api';

const DiagramScene = dynamic(() => import('@/lib/diagram3d/DiagramScene'), { ssr: false });
const BUTTON = 'rounded-lg border border-[#d7cfc7] bg-white px-3 py-2 text-sm text-[#62564c] hover:border-[#a6192e] focus-visible:outline-2 focus-visible:outline-[#a6192e] disabled:cursor-not-allowed disabled:opacity-40';
const PRIMARY_BUTTON = 'rounded-lg border border-[#a6192e] bg-[#a6192e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#89172d] focus-visible:outline-2 focus-visible:outline-[#a6192e] disabled:cursor-not-allowed disabled:opacity-40';

/** File previews remain local. Only the explicit Import action saves objects. */
export default function ObjectFolderImportDialog({ section, owner, onClose, onImported }: {
  section: LibrarySection;
  owner: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);
  const stop = useRef(false);
  const running = useRef(false);
  const preparation = useRef(0);
  const templates = useObjectLibrary((state) => state.templates);
  const libraryError = useObjectLibrary((state) => state.error);
  const [candidates, setCandidates] = useState<ObjectFolderCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [previewIn3D, setPreviewIn3D] = useState(true);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [includeCopies, setIncludeCopies] = useState(false);
  const [phase, setPhase] = useState<'reading' | 'importing' | null>(null);
  const [stopping, setStopping] = useState(false);
  const [activeName, setActiveName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const busy = phase !== null;

  useEffect(() => {
    mounted.current = true;
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => {
      mounted.current = false;
      stop.current = true;
      if (element?.open) element.close();
    };
  }, []);

  useEffect(() => {
    const objects = candidates.filter((item) => item.recipe);
    let index = 0, frame = 0;
    const renderNext = () => {
      const item = objects[index++];
      if (!item?.recipe) return;
      try {
        const thumbnail = renderObjectThumbnail(item.recipe);
        if (thumbnail) setThumbnails((current) => ({ ...current, [item.id]: thumbnail }));
      } catch { /* A missing thumbnail does not prevent the rotatable preview. */ }
      if (index < objects.length) frame = requestAnimationFrame(renderNext);
    };
    frame = requestAnimationFrame(renderNext);
    return () => cancelAnimationFrame(frame);
  }, [candidates]);

  const rows = useMemo(() => {
    const known: Object3DTemplate[] = [...(templates ?? [])];
    return candidates.map((item) => {
      const duplicate = item.recipe ? findDuplicate(known, item.name, item.recipe) : null;
      if (item.recipe) known.push({ id: `folder:${item.id}`, sectionId: section.id,
        name: item.name, recipe: item.recipe, updatedAt: '' });
      return { ...item, duplicate: duplicate?.identical
        ? duplicate.template.id.startsWith('folder:') ? 'Repeated in this folder' : 'Already in your libraries'
        : null };
    });
  }, [candidates, section.id, templates]);
  const available = rows.filter((item) => item.recipe && !imported.has(item.id) && (!item.duplicate || includeCopies));
  const chosen = available.filter((item) => selected.has(item.id));
  const remainingSlots = Math.max(0, 200 - (templates?.length ?? 0));
  const focused = candidates.find((item) => item.id === focusedId && item.recipe);
  const preview = useMemo(() => {
    if (!focused?.recipe) return null;
    const size = focused.recipe.size ?? { width: 100, height: 100, depth: 1 };
    return buildDiagramScene([{ id: 'folder-preview', type: 'CubeNode', position: { x: 0, y: 0 },
      width: size.width, height: size.height,
      data: { label: '', visual3d: focused.recipe, fillColor: focused.recipe.fill ?? '#263341',
        spatial3d: { depth: size.depth, elevation: 0 } } }], []);
  }, [focused]);

  const close = () => {
    if (running.current) { stop.current = true; setStopping(true); return; }
    preparation.current++;
    onClose();
  };
  const chooseFolder = async () => {
    if (busy) return;
    const version = ++preparation.current;
    setError('');
    try {
      const files = await pickObjectFolder();
      if (!files || !mounted.current || preparation.current !== version) return;
      setPhase('reading');
      const items = await parseObjectFolderFiles(files);
      if (!mounted.current || preparation.current !== version) return;
      setCandidates(items);
      setSelected(new Set(items.filter((item) => item.recipe).map((item) => item.id)));
      setFocusedId(items.find((item) => item.recipe)?.id ?? null);
      setPreviewIn3D(true);
      setThumbnails({}); setImported(new Set()); setFailures({});
      setIncludeCopies(false); setMessage('');
    } catch (failure) {
      if (mounted.current && preparation.current === version) {
        setError(failure instanceof Error ? failure.message : 'Could not read the folder.');
      }
    } finally {
      if (mounted.current && preparation.current === version) setPhase(null);
    }
  };

  const importSelected = async () => {
    if (running.current || busy || !chosen.length || templates === null || libraryError || chosen.length > remainingSlots) return;
    running.current = true; stop.current = false;
    setPhase('importing'); setStopping(false); setError(''); setMessage('');
    const queue = [...chosen];
    let saved = 0, failed = 0, skipped = 0;
    try {
      for (const item of queue) {
        if (stop.current || !mounted.current || useAuthStore.getState().user?.id !== owner) break;
        if (!item.recipe) continue;
        // Recheck after each save: another import may have changed the library.
        const current = useObjectLibrary.getState();
        if (!includeCopies && findDuplicate(current.templates, item.name, item.recipe)?.identical) { skipped++; continue; }
        setActiveName(item.name);
        try {
          if ((current.templates?.length ?? 0) >= 200) throw new Error('Your libraries already contain 200 3D objects.');
          let thumbnail: string | undefined = thumbnails[item.id];
          if (!thumbnail) {
            try { thumbnail = renderObjectThumbnail(item.recipe) ?? undefined; } catch { /* Import still works without WebGL. */ }
          }
          const created = await objectLibraryApi.create(section.id, item.name, item.recipe);
          // A response for the previous account must not enter the new account's store.
          if (useAuthStore.getState().user?.id !== owner) break;
          useObjectLibrary.setState((state) => ({ templates: [created, ...(state.templates ?? [])],
            ...(thumbnail ? { thumbnails: { ...state.thumbnails, [created.id]: thumbnail } } : {}) }));
          saved++;
          if (mounted.current) {
            setImported((current) => new Set(current).add(item.id));
            setFailures((current) => { const next = { ...current }; delete next[item.id]; return next; });
            onImported();
          }
        } catch (failure) {
          failed++;
          if (mounted.current) setFailures((current) => ({ ...current, [item.id]:
            failure instanceof Error ? failure.message : 'Could not import this object.' }));
        }
      }
    } finally {
      running.current = false;
      if (mounted.current) {
        setPhase(null); setActiveName(''); setStopping(false);
        setMessage(`${stop.current ? 'Import stopped. ' : ''}${saved} imported${skipped ? `, ${skipped} already present` : ''}${failed ? `, ${failed} failed — click Import to retry` : ''}.`);
      }
    }
  };

  return <dialog ref={dialog} aria-label="Import 3D folder"
    className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[1040px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-xl border border-[#d8cec5] bg-[#faf8f6] p-5 text-[#352b24] shadow-xl backdrop:bg-black/45 sm:p-7"
    onCancel={(event) => { event.preventDefault(); close(); }} onKeyDown={(event) => event.stopPropagation()} onKeyUp={(event) => event.stopPropagation()}>
    <button type="button" aria-label="Close folder preview" className={`${BUTTON} absolute top-4 right-4 p-2`} disabled={phase === 'importing'} onClick={close}><X size={18} /></button>
    <h2 className="m-0 pr-12 text-2xl font-semibold">Import 3D folder</h2>
    <p className="mt-2 mb-4 max-w-2xl text-sm text-[#827567]">Choose a folder of EasyDraw 3D JSON files. Preview each object and select what to add to <strong>{section.name}</strong>.</p>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <button type="button" className={`${BUTTON} flex items-center gap-2`} disabled={busy} onClick={() => void chooseFolder()}><FolderOpen size={17} />{phase === 'reading' ? 'Reading folder…' : 'Choose folder'}</button>
      {candidates.length > 0 && <span className="text-sm text-[#827567]">{candidates.length} JSON files · {chosen.length} selected</span>}
    </div>
    {(error || libraryError) && <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {error || libraryError}
      {libraryError && <button type="button" className={`${BUTTON} ml-3`} onClick={() => void useObjectLibrary.getState().load()}>Retry library load</button>}
    </div>}
    {candidates.length > 0 ? <>
      <fieldset disabled={busy} className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-0 p-0 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={available.length > 0 && chosen.length === available.length}
          onChange={(event) => setSelected(event.target.checked ? new Set(available.map((item) => item.id)) : new Set())} />Select all available objects</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={includeCopies} onChange={(event) => setIncludeCopies(event.target.checked)} />Include existing objects as copies</label>
      </fieldset>
      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="grid max-h-[440px] grid-cols-2 content-start gap-3 overflow-y-auto p-1 sm:grid-cols-3">
          {rows.map((item) => {
            const status = !item.recipe ? 'invalid' : imported.has(item.id) ? 'imported' : failures[item.id] ? 'failed' : item.duplicate ? 'duplicate' : 'ready';
            return <article key={item.id} data-object-folder-row data-file-path={item.path} data-import-status={status}
              className={`min-w-0 rounded-lg border bg-white p-2 ${focusedId === item.id ? 'border-[#a6192e] ring-1 ring-[#a6192e]/20' : 'border-[#e1d8ce]'}`}>
              <div className="mb-1 flex items-center justify-between gap-1">
                <input type="checkbox" aria-label={`Select ${item.path}`} checked={chosen.some((candidate) => candidate.id === item.id)}
                  disabled={busy || !item.recipe || imported.has(item.id) || Boolean(item.duplicate && !includeCopies)}
                  onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(item.id); else next.delete(item.id); return next; })} />
                <span className={`text-[10px] ${status === 'invalid' || status === 'failed' ? 'text-red-700' : status === 'imported' ? 'text-green-700' : 'text-[#827567]'}`}>{status === 'imported' ? <span className="flex items-center gap-1"><Check size={12} />Imported</span> : status === 'duplicate' ? 'Duplicate' : status === 'failed' ? 'Failed' : status === 'invalid' ? 'Invalid' : 'Ready'}</span>
              </div>
              <button type="button" aria-label={`Preview ${item.name}`} disabled={!item.recipe || phase === 'importing'}
                className="flex w-full flex-col items-center rounded text-center focus-visible:outline-2 focus-visible:outline-[#a6192e] disabled:cursor-default" onClick={() => { setFocusedId(item.id); setPreviewIn3D(true); }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumbnails[item.id] ? <img src={thumbnails[item.id]} alt={item.name} draggable={false} className="h-24 w-full object-contain" /> : <span className="flex h-24 w-full items-center justify-center"><Box size={26} className="text-[#a6192e]/60" /></span>}
                <span className="w-full break-words text-xs font-medium">{item.name}</span>
              </button>
              <p className="mt-1 mb-0 truncate text-[10px] text-[#9c9186]" title={item.path}>{item.path}</p>
              {(item.error || failures[item.id] || item.duplicate && !imported.has(item.id)) && <p className={`mt-1 mb-0 break-words text-[10px] ${item.error || failures[item.id] ? 'text-red-700' : 'text-[#827567]'}`}>{item.error || failures[item.id] || item.duplicate}</p>}
            </article>;
          })}
        </div>
        <section aria-label={focused ? `3D preview: ${focused.name}` : '3D preview'} className="min-w-0 overflow-hidden rounded-lg border border-[#e1d8ce] bg-[#f8f5ee]">
          <div className="flex items-center justify-between gap-2 border-b border-[#e1d8ce] px-3 py-2">
            <p className="m-0 min-w-0 break-words text-sm font-medium">{focused?.name ?? 'Choose an object to preview'}</p>
            {focused && <div className="flex shrink-0 gap-1">
              <button type="button" aria-label="2D preview" aria-pressed={!previewIn3D} className={`${BUTTON} px-2 py-1 text-xs ${!previewIn3D ? 'border-[#a6192e] text-[#a6192e]' : ''}`} onClick={() => setPreviewIn3D(false)}>2D</button>
              <button type="button" aria-label="3D preview" aria-pressed={previewIn3D} className={`${BUTTON} px-2 py-1 text-xs ${previewIn3D ? 'border-[#a6192e] text-[#a6192e]' : ''}`} onClick={() => setPreviewIn3D(true)}>3D</button>
            </div>}
          </div>
          <div className="h-[390px]">
            {focused?.recipe && preview && (previewIn3D ? <DiagramScene key={focused.id} model={preview} standalone showGrid={false}
              onCameraChange={() => {}} onReturnTo2D={() => setPreviewIn3D(false)} />
              : <div role="img" aria-label={`2D preview: ${focused.name}`} className="flex h-full items-center justify-center p-8">
                <PlanGlyph recipe={focused.recipe} fill={focused.recipe.fill ?? '#263341'} opacity={1} className="h-full w-full" />
              </div>)}
          </div>
        </section>
      </div>
      {chosen.length > remainingSlots && <p role="alert" className="mt-3 text-sm text-red-700">Your libraries have space for {remainingSlots} more objects. Select fewer objects to import.</p>}
    </> : <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#d7cfc7] text-sm text-[#827567]"><FolderOpen size={30} /><p className="m-0">Choose a folder to preview its 3D objects.</p></div>}
    <div role="status" aria-live="polite" className="mt-4 min-h-5 text-sm text-[#827567]">{phase === 'importing' ? `${stopping ? 'Stopping after the current object' : 'Importing'}: ${activeName}…` : message}</div>
    <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e1d8ce] pt-4">
      <p className="m-0 text-xs text-[#9c9186]">Objects are saved to your private library when you click Import.</p>
      <div className="flex gap-2">
        {phase === 'importing' ? <button type="button" className={BUTTON} disabled={stopping} onClick={() => { stop.current = true; setStopping(true); }}>Stop import</button>
          : <button type="button" className={BUTTON} onClick={close}>{imported.size > 0 ? 'Close' : 'Cancel'}</button>}
        <button type="button" className={PRIMARY_BUTTON}
          disabled={busy || !chosen.length || templates === null || Boolean(libraryError) || chosen.length > remainingSlots}
          onClick={() => void importSelected()}>{phase === 'importing' ? 'Importing…' : `Import ${chosen.length} objects`}</button>
      </div>
    </footer>
  </dialog>;
}
