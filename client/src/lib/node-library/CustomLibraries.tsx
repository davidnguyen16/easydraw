'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { validateVisual3DRecipe, type Visual3DRecipe } from '@easydraw/diagram-schema';
import { dndState } from '@/lib/flow/dnd';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useObjectLibrary } from '@/lib/diagram3d/object-library';
import { findDuplicate, duplicateNotice } from '@/lib/diagram3d/duplicate-object';
import DuplicateObjectPrompt from '@/lib/diagram3d/DuplicateObjectPrompt';
import { downloadObjectFile, pickObjectFile } from '@/lib/diagram3d/object-files';
import { NodeLibraryError, nodeLibraryApi, uploadToS3, type LibraryNode, type LibrarySection } from './api';
import { useAssetUrl } from './assets';
import { CUSTOM_IMAGE_ACCEPT, filterLibraryNodes, nodeDragPayload, reorderUpdates, validateCustomImageFile } from './library-utils';
import CustomLibrariesDialog from './CustomLibrariesDialog';
import LibrarySectionContextMenu from './LibrarySectionContextMenu';
import LibraryNodeContextMenu from './LibraryNodeContextMenu';
import LibraryObjectContextMenu from './LibraryObjectContextMenu';
import LibraryObjectTile from './LibraryObjectTile';

const BUTTON = 'rounded border border-line bg-white px-2 py-1 text-xs text-ink-soft hover:border-mq-red disabled:cursor-not-allowed disabled:opacity-40';
const INPUT = 'min-w-0 rounded border border-line bg-white px-2 py-1 text-xs text-ink-soft outline-none focus:border-mq-red';

interface MenuPosition {
  x: number;
  y: number;
  trigger: HTMLButtonElement;
}

function LibraryNodePaletteTile({ node, disabled, onOpenMenu }: {
  node: LibraryNode;
  disabled: boolean;
  onOpenMenu: (position: MenuPosition) => void;
}) {
  const image = useAssetUrl(node.assetId, 'thumbnail');
  return (
    <button
      type="button"
      className="flex aspect-square min-w-0 cursor-grab items-center justify-center overflow-hidden rounded-lg border border-[#e8e2d3] bg-white p-1 text-mq-red transition-[border-color,box-shadow] duration-150 hover:border-mq-red hover:shadow-[0_1px_4px_rgba(166,25,46,0.15)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mq-red active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
      aria-label={`Drag ${node.name} to canvas`}
      aria-haspopup="menu"
      title={`${node.name} — drag to canvas; right-click to rename or remove`}
      draggable={!disabled}
      disabled={disabled}
      onDragStart={(event) => {
        dndState.current = nodeDragPayload(node);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', node.name);
      }}
      onDragEnd={() => { dndState.current = null; }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const trigger = event.currentTarget;
        const bounds = trigger.getBoundingClientRect();
        onOpenMenu({ x: event.clientX || bounds.left, y: event.clientY || bounds.bottom, trigger });
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
        event.preventDefault();
        event.stopPropagation();
        const trigger = event.currentTarget;
        const bounds = trigger.getBoundingClientRect();
        onOpenMenu({ x: bounds.left, y: bounds.bottom, trigger });
      }}
    >
      {/* Private images are resolved to authenticated blob URLs, not Next image URLs. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image.url ? <img src={image.url} alt="" draggable={false} className="size-full min-h-0 min-w-0 object-contain" /> : <span className="text-center text-[9px] leading-tight text-ink-muted" title={image.error}>{image.loading ? 'Loading…' : 'No preview'}</span>}
    </button>
  );
}

function orderedSections(sections: LibrarySection[]): LibrarySection[] {
  return sections.map((section) => ({ ...section, nodes: [...section.nodes].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)) })).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function NameForm({ initial = '', label, onSubmit, onCancel }: { initial?: string; label: string; onSubmit: (name: string) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try { await onSubmit(name.trim()); onCancel(); }
    catch { /* Parent action renders the API error; retain the typed value. */ }
    finally { setSaving(false); }
  };
  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <label className="flex flex-col gap-1 text-xs text-ink-soft">{label}<input autoFocus required maxLength={100} className={INPUT} value={name} disabled={saving} onChange={(event) => setName(event.target.value)} /></label>
      <div className="flex gap-1"><button className={BUTTON} type="submit" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save'}</button><button className={BUTTON} type="button" disabled={saving} onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function LibraryNodeTile({ node, sections, disabled, onAction, onReorder, first, last, inManager = false }: {
  node: LibraryNode;
  sections: LibrarySection[];
  disabled: boolean;
  onAction: (action: () => Promise<unknown>) => Promise<void>;
  onReorder: (direction: -1 | 1) => Promise<void>;
  first: boolean;
  last: boolean;
  inManager?: boolean;
}) {
  const image = useAssetUrl(node.assetId, 'thumbnail');
  const [renaming, setRenaming] = useState(false);
  return (
    <div className="rounded-lg border border-line bg-white p-2">
      <button
        type="button"
        className={`flex w-full items-center gap-2 text-left disabled:cursor-default ${inManager ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
        aria-label={inManager ? `Preview ${node.name}` : `Drag ${node.name} to canvas`}
        title={inManager ? node.name : `Drag ${node.name} to the 2D or 3D canvas`}
        draggable={!disabled && !inManager}
        disabled={disabled}
        onDragStart={(event) => {
          if (inManager) { event.preventDefault(); return; }
          dndState.current = nodeDragPayload(node);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', node.name);
        }}
        onDragEnd={() => { dndState.current = null; }}
      >
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded bg-[#f6f5f1]">
          {/* Signed S3 URLs are fetched as blobs first; Next image optimization cannot authenticate them. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {image.url ? <img src={image.url} alt="" draggable={false} className="size-full object-contain" /> : <span className="px-1 text-center text-[10px] text-ink-muted" title={image.error}>{image.loading ? 'Loading…' : 'No preview'}</span>}
        </span>
        <span className="min-w-0 break-words text-xs text-ink-soft">{node.name}</span>
      </button>
      <details className="mt-1 text-xs text-ink-soft">
        <summary className="cursor-pointer py-1" aria-label={`Manage ${node.name}`}>Manage</summary>
        <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-2 border-0 p-0">
          {renaming ? <NameForm key={node.id} initial={node.name} label="Node name" onSubmit={(name) => onAction(() => nodeLibraryApi.updateNode(node.id, { name }))} onCancel={() => setRenaming(false)} /> : <button type="button" className={BUTTON} onClick={() => setRenaming(true)}>Rename node</button>}
          <label className="flex flex-col gap-1">Move to library<select className={INPUT} value={node.sectionId} onChange={(event) => void onAction(() => nodeLibraryApi.updateNode(node.id, { sectionId: event.target.value })).catch(() => {})}>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
          <div className="flex flex-wrap gap-1">
            <button type="button" className={BUTTON} aria-label={`Move ${node.name} up`} disabled={first} onClick={() => void onReorder(-1).catch(() => {})}>↑</button>
            <button type="button" className={BUTTON} aria-label={`Move ${node.name} down`} disabled={last} onClick={() => void onReorder(1).catch(() => {})}>↓</button>
            <button type="button" className={BUTTON} onClick={() => {
              if (window.confirm(`Remove “${node.name}” from this library? Existing diagrams keep their image.`)) void onAction(() => nodeLibraryApi.deleteNode(node.id)).catch(() => {});
            }}>Remove node</button>
          </div>
        </fieldset>
      </details>
    </div>
  );
}

interface UploadStatus {
  name: string;
  progress: number;
  state: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
  assetId?: string;
  canRetryComplete?: boolean;
}

async function completeWithRetry(assetId: string, signal: AbortSignal, owner: string | undefined) {
  for (let attempt = 0; ; attempt += 1) {
    if (signal.aborted || useAuthStore.getState().user?.id !== owner) throw new DOMException('Upload cancelled', 'AbortError');
    try { await nodeLibraryApi.completeUpload(assetId); return; }
    catch (failure) {
      if (!(failure instanceof NodeLibraryError) || ![409, 503].includes(failure.status) || attempt >= 2 || signal.aborted) throw failure;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1500));
    }
  }
}

export default function CustomLibraries({ searchQuery }: { searchQuery: string }) {
  const owner = useAuthStore((state) => state.user?.id);
  // Drop local names, progress and drafts as well as image blobs on account changes.
  return owner ? <PrivateLibraries key={owner} searchQuery={searchQuery} /> : null;
}

function PrivateLibraries({ searchQuery }: { searchQuery: string }) {
  const userId = useAuthStore((state) => state.user?.id);
  const [library, setLibrary] = useState<{ owner: string; sections: LibrarySection[] }>({ owner: '', sections: [] });
  const [error, setError] = useState('');
  const [loadedOwner, setLoadedOwner] = useState('');
  const [busy, setBusy] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [sectionMenu, setSectionMenu] = useState<{ sectionId: string; x: number; y: number; trigger: HTMLButtonElement } | null>(null);
  const [nodeMenu, setNodeMenu] = useState<(MenuPosition & { sectionId: string; nodeId: string }) | null>(null);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [objectMenu, setObjectMenu] = useState<(MenuPosition & { objectId: string }) | null>(null);
  const [renamingObjectId, setRenamingObjectId] = useState<string | null>(null);
  const [objectNotice, setObjectNotice] = useState<string | null>(null);
  // An import that matched an object the account already has, waiting on a decision.
  const [pendingImport, setPendingImport] = useState<{ name: string; recipe: Visual3DRecipe; sectionId: string; library: string } | null>(null);
  // 3D objects share the libraries; their store is also the Object tab's.
  const templates = useObjectLibrary((state) => state.templates);
  const thumbnails = useObjectLibrary((state) => state.thumbnails);
  const loadObjects = useObjectLibrary((state) => state.load);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const uploadController = useRef<AbortController | null>(null);
  const sections = library.owner === userId ? library.sections : [];
  const uploading = uploads.some((item) => item.state === 'uploading' || item.state === 'processing');
  const menuSectionIndex = sectionMenu ? sections.findIndex((section) => section.id === sectionMenu.sectionId) : -1;
  const menuSection = sections[menuSectionIndex];
  const menuNode = nodeMenu ? sections.find((section) => section.id === nodeMenu.sectionId)?.nodes.find((node) => node.id === nodeMenu.nodeId) : undefined;
  const menuObject = objectMenu ? templates?.find((template) => template.id === objectMenu.objectId) : undefined;
  const renamingObject = renamingObjectId ? templates?.find((template) => template.id === renamingObjectId) : undefined;

  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!userId) return;
    const result = await nodeLibraryApi.list(signal);
    if (useAuthStore.getState().user?.id !== userId || signal?.aborted) return;
    setLibrary({ owner: userId, sections: orderedSections(result.sections) });
    setLoadedOwner(userId);
    setError('');
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void nodeLibraryApi.list(controller.signal).then((result) => {
      if (controller.signal.aborted || useAuthStore.getState().user?.id !== userId) return;
      setLibrary({ owner: userId, sections: orderedSections(result.sections) });
      setLoadedOwner(userId);
      setError('');
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Could not load custom libraries.');
        setLoadedOwner(userId ?? '');
      }
    });
    return () => { controller.abort(); uploadController.current?.abort(); };
  }, [userId]);

  useEffect(() => {
    if (userId) void loadObjects();
  }, [userId, loadObjects]);

  // The Object tab can create a library; pick it up without a page reload.
  useEffect(() => useObjectLibrary.subscribe((state, previous) => {
    if (state.librariesVersion !== previous.librariesVersion) void reload().catch(() => {});
  }), [reload]);

  const action = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try { await operation(); await reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update library.'); throw failure; }
    finally { setBusy(false); }
  };

  const uploadFiles = async (section: LibrarySection, files: File[]) => {
    if (!files.length || uploading || busy) return;
    if (files.length > 20) { setError('Upload at most 20 images at a time.'); return; }
    const controller = new AbortController();
    uploadController.current = controller;
    setError('');
    setExpanded((current) => ({ ...current, [section.id]: true }));
    setUploads(files.map((file) => ({ name: file.name, progress: 0, state: 'uploading' })));
    const update = (index: number, patch: Partial<UploadStatus>) => setUploads((current) => current.map((item, position) => position === index ? { ...item, ...patch } : item));
    // Sequential upload/normalization keeps browser and server memory bounded.
    for (let index = 0; index < files.length; index += 1) {
      if (controller.signal.aborted || useAuthStore.getState().user?.id !== userId) break;
      const file = files[index];
      let assetId: string | undefined;
      let transferred = false;
      try {
        const invalid = validateCustomImageFile(file);
        if (invalid) throw new Error(invalid);
        const upload = await nodeLibraryApi.beginUpload(section.id, file);
        assetId = upload.assetId;
        if (controller.signal.aborted) break;
        await uploadToS3(upload.url, upload.fields, file, (progress) => update(index, { progress }), controller.signal);
        transferred = true;
        if (controller.signal.aborted || useAuthStore.getState().user?.id !== userId) break;
        update(index, { state: 'processing', progress: 100, assetId });
        await completeWithRetry(assetId, controller.signal, userId);
        if (controller.signal.aborted) break;
        update(index, { state: 'done' });
      } catch (failure) {
        if (controller.signal.aborted) break;
        const permanent = failure instanceof NodeLibraryError && [400, 404, 413, 415, 422].includes(failure.status);
        update(index, { state: 'error', assetId, canRetryComplete: transferred && !permanent, error: failure instanceof Error ? failure.message : 'Upload failed.' });
      }
    }
    if (!controller.signal.aborted) {
      try { await reload(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not refresh library.'); }
    }
  };

  const objectAction = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try { await operation(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update the 3D object.'); throw failure; }
    finally { setBusy(false); }
  };

  const libraryName = (id: string) => sections.find((section) => section.id === id)?.name ?? 'another library';

  /** Stores the object; reports any weaker overlap with what is already there. */
  const storeImport = async (sectionId: string, name: string, recipe: Visual3DRecipe, overlap = true) => {
    const match = overlap ? findDuplicate(templates, name, recipe) : null;
    setExpanded((current) => ({ ...current, [sectionId]: true }));
    await objectAction(async () => {
      const created = await useObjectLibrary.getState().add(sectionId, name, recipe);
      setObjectNotice(match ? duplicateNotice(match, libraryName(match.template.sectionId), created.name) : null);
    }).catch(() => {});
  };

  const importObject = async (section: LibrarySection) => {
    const file = await pickObjectFile();
    if (!file) return;
    const result = validateVisual3DRecipe(file.recipe);
    if (!result.valid) { setError(`Not a 3D object file: ${result.issues[0]?.message ?? 'invalid recipe'}`); return; }
    const recipe = file.recipe as Visual3DRecipe;
    const match = findDuplicate(templates, file.name, recipe);
    setError('');
    setObjectNotice(null);
    // The same shape under another name is a legitimate variant; only the exact
    // same object stops to ask.
    if (match?.identical) {
      setPendingImport({ name: file.name, recipe, sectionId: section.id, library: libraryName(match.template.sectionId) });
      return;
    }
    await storeImport(section.id, file.name, recipe);
  };

  const retryCompletion = async (index: number, item: UploadStatus) => {
    if (!item.assetId || uploading) return;
    const controller = new AbortController();
    uploadController.current = controller;
    const update = (patch: Partial<UploadStatus>) => setUploads((current) => current.map((upload, position) => position === index ? { ...upload, ...patch } : upload));
    update({ state: 'processing', error: undefined });
    try {
      await completeWithRetry(item.assetId, controller.signal, userId);
      if (controller.signal.aborted) return;
      update({ state: 'done', canRetryComplete: false });
      await reload();
    } catch (failure) {
      if (controller.signal.aborted) return;
      const permanent = failure instanceof NodeLibraryError && [400, 404, 413, 415, 422].includes(failure.status);
      update({ state: 'error', canRetryComplete: !permanent, error: failure instanceof Error ? failure.message : 'Could not prepare the image.' });
    }
  };

  if (!userId) return null;

  const uploadStatus = uploads.length > 0 ? <div className="flex flex-col gap-2 rounded border border-line p-2 text-xs" role="status" aria-live="polite">
    {uploads.map((item, index) => <div key={`${index}:${item.name}`} className="min-w-0"><p className="m-0 break-words text-ink-soft">{item.name}: {item.state === 'done' ? 'Ready' : item.state === 'processing' ? 'Preparing image…' : item.state === 'error' ? item.error : `${item.progress}%`}</p>{item.state === 'uploading' && <progress className="h-1 w-full" max={100} value={item.progress} aria-label={`Uploading ${item.name}`} />}{item.state === 'error' && item.canRetryComplete && <button type="button" className={`${BUTTON} mt-1`} disabled={uploading || busy} onClick={() => void retryCompletion(index, item)}>Retry preparing {item.name}</button>}</div>)}
    {uploads.some((item) => item.state === 'error' && !item.canRetryComplete) && <p className="m-0 text-ink-muted">You can upload failed files again. Unused upload reservations expire automatically.</p>}
    {!uploading && <button type="button" className={BUTTON} onClick={() => setUploads([])}>Dismiss</button>}
  </div> : null;

  const retryLoading = () => void reload().catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Could not load libraries.'));

  return (
    <div className="flex min-w-0 flex-col gap-[1.4em] border-t border-line pt-4" data-custom-libraries>
      <h2 className="m-0 text-[0.72rem] font-medium tracking-[0.06em] text-[#969ba3] uppercase">Private</h2>
      {loadedOwner !== userId && <p className="text-xs text-ink-muted" role="status">Loading your libraries…</p>}
      {sections.map((section) => {
        const nodes = filterLibraryNodes(section.nodes, searchQuery, section.name);
        const sectionMatches = section.name.toLowerCase().includes(searchQuery);
        const objects = (templates ?? []).filter((template) => template.sectionId === section.id && (!searchQuery || sectionMatches || template.name.toLowerCase().includes(searchQuery)));
        if (searchQuery && !nodes.length && !objects.length && !sectionMatches) return null;
        const open = Boolean(searchQuery) || (expanded[section.id] ?? false);
        const renamingNode = section.nodes.find((node) => node.id === renamingNodeId);
        const renamingObjectHere = renamingObject?.sectionId === section.id ? renamingObject : undefined;
        return (
          <section key={section.id} className="flex min-w-0 flex-col gap-[0.6rem]" aria-label={`${section.name} custom library`}>
            <button
              className="group flex w-full min-w-0 cursor-pointer items-center gap-2 border-none bg-transparent px-0 py-[0.2rem] text-left text-mq-maroon focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mq-red"
              type="button"
              aria-expanded={open}
              aria-haspopup="menu"
              title="Right-click for library actions"
              onClick={() => setExpanded((current) => ({ ...current, [section.id]: !open }))}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const trigger = event.currentTarget;
                const bounds = trigger.getBoundingClientRect();
                setNodeMenu(null);
                setObjectMenu(null);
                setSectionMenu({ sectionId: section.id, x: event.clientX || bounds.left, y: event.clientY || bounds.bottom, trigger });
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
                event.preventDefault();
                event.stopPropagation();
                const trigger = event.currentTarget;
                const bounds = trigger.getBoundingClientRect();
                setNodeMenu(null);
                setObjectMenu(null);
                setSectionMenu({ sectionId: section.id, x: bounds.left, y: bounds.bottom, trigger });
              }}
            >
              <svg
                className={`size-3.5 shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
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
              <span className="min-w-0 break-words text-[0.72rem] font-bold tracking-[0.06em] uppercase group-hover:underline">{section.name}</span>
            </button>
            {renaming === section.id && <fieldset className="min-w-0 border-0 p-0" disabled={busy || uploading}>
              <NameForm key={section.id} initial={section.name} label="Library name" onSubmit={(name) => action(() => nodeLibraryApi.updateSection(section.id, { name }))} onCancel={() => setRenaming(null)} />
            </fieldset>}
            {open && <>
              {nodes.length === 0 && objects.length === 0 && <p className="m-0 text-xs text-ink-muted">Upload images or import 3D objects, then drag them onto your diagram.</p>}
              <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-2" data-custom-node-grid>
                {nodes.map((node) => <LibraryNodePaletteTile key={node.id} node={node} disabled={busy || uploading} onOpenMenu={(position) => {
                  setSectionMenu(null);
                  setObjectMenu(null);
                  setNodeMenu({ ...position, sectionId: section.id, nodeId: node.id });
                }} />)}
                {objects.map((template) => <LibraryObjectTile key={template.id} template={template} thumbnail={thumbnails[template.id]} disabled={busy || uploading} onOpenMenu={(position) => {
                  setSectionMenu(null);
                  setNodeMenu(null);
                  setObjectMenu({ ...position, objectId: template.id });
                }} />)}
              </div>
              {renamingNode && <fieldset className="min-w-0 rounded border border-line bg-white p-2" disabled={busy || uploading}>
                <NameForm key={renamingNode.id} initial={renamingNode.name} label="Node name" onSubmit={(name) => action(() => nodeLibraryApi.updateNode(renamingNode.id, { name }))} onCancel={() => setRenamingNodeId(null)} />
              </fieldset>}
              {renamingObjectHere && <fieldset className="min-w-0 rounded border border-line bg-white p-2" disabled={busy || uploading}>
                <NameForm key={renamingObjectHere.id} initial={renamingObjectHere.name} label="Object name" onSubmit={(name) => objectAction(() => useObjectLibrary.getState().update(renamingObjectHere.id, { name }))} onCancel={() => setRenamingObjectId(null)} />
              </fieldset>}
              <div className="grid grid-cols-2 gap-1.5">
                <label className={`relative flex cursor-pointer items-center justify-center rounded border border-dashed border-line px-2 py-2 text-center text-xs text-mq-maroon hover:border-mq-red ${busy || uploading ? 'opacity-40' : ''}`}>
                  + Upload images
                  <input className="absolute inset-0 w-full cursor-pointer opacity-0" type="file" accept={CUSTOM_IMAGE_ACCEPT} multiple disabled={busy || uploading} aria-label={`Upload images to ${section.name}`} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void uploadFiles(section, files); }} />
                </label>
                <button type="button" className="cursor-pointer rounded border border-dashed border-line px-2 py-2 text-center text-xs text-mq-maroon hover:border-mq-red disabled:cursor-default disabled:opacity-40" disabled={busy || uploading} aria-label={`Import a 3D object into ${section.name}`} onClick={() => void importObject(section)}>+ Import 3D object</button>
              </div>
            </>}
          </section>
        );
      })}

      {!managerOpen && pendingImport && <DuplicateObjectPrompt
        name={pendingImport.name}
        library={pendingImport.library}
        busy={busy}
        onCancel={() => setPendingImport(null)}
        onImportAnyway={() => { const item = pendingImport; setPendingImport(null); void storeImport(item.sectionId, item.name, item.recipe, false); }}
      />}
      {!managerOpen && objectNotice && <p role="status" className="text-xs leading-relaxed text-ink-muted">{objectNotice}</p>}
      {!managerOpen && uploadStatus}
      {!managerOpen && error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800"><p className="m-0 break-words">{error}</p><button type="button" className={`${BUTTON} mt-2`} onClick={retryLoading}>Retry</button></div>}
      <div className="flex flex-col gap-2">
        <button type="button" className="cursor-pointer rounded-lg border border-mq-red bg-white px-3 py-2 text-sm font-semibold text-mq-maroon transition-[background-color,color,box-shadow,border-color] duration-150 enabled:hover:border-[#ad3647] enabled:hover:bg-[#ad3647] enabled:hover:text-white enabled:hover:shadow-[inset_0_0_0_1px_#fff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mq-red" aria-haspopup="dialog" aria-expanded={managerOpen} onClick={() => { setSectionMenu(null); setNodeMenu(null); setManagerOpen(true); }}>+ Custom Libraries</button>
      </div>
      {!managerOpen && sectionMenu && menuSection && <LibrarySectionContextMenu
        key={`${menuSection.id}:${sectionMenu.x}:${sectionMenu.y}`}
        x={sectionMenu.x}
        y={sectionMenu.y}
        trigger={sectionMenu.trigger}
        sectionName={menuSection.name}
        disabled={busy || uploading}
        canMoveUp={menuSectionIndex > 0}
        canMoveDown={menuSectionIndex < sections.length - 1}
        onClose={() => setSectionMenu(null)}
        onRename={() => {
          setRenamingNodeId(null);
          setRenaming(menuSection.id);
          setExpanded((current) => ({ ...current, [menuSection.id]: true }));
        }}
        onMove={(direction) => {
          void action(async () => {
            for (const update of reorderUpdates(sections, menuSection.id, direction)) await nodeLibraryApi.updateSection(update.id, { sortOrder: update.sortOrder });
          }).catch(() => {});
        }}
        onRemove={() => {
          if (window.confirm(`Remove library “${menuSection.name}” and its library entries? Existing diagrams keep their images and 3D objects.`)) void action(async () => { await nodeLibraryApi.deleteSection(menuSection.id); await loadObjects(); }).catch(() => {});
        }}
      />}
      {!managerOpen && objectMenu && menuObject && <LibraryObjectContextMenu
        key={`${menuObject.id}:${objectMenu.x}:${objectMenu.y}`}
        x={objectMenu.x}
        y={objectMenu.y}
        trigger={objectMenu.trigger}
        objectName={menuObject.name}
        disabled={busy || uploading}
        onClose={() => setObjectMenu(null)}
        onRename={() => { setRenaming(null); setRenamingNodeId(null); setRenamingObjectId(menuObject.id); }}
        onDownload={() => downloadObjectFile(menuObject.name, menuObject.recipe)}
        onRemove={() => {
          if (window.confirm(`Remove “${menuObject.name}” from this library? Existing diagrams keep the object.`)) void objectAction(() => useObjectLibrary.getState().remove(menuObject.id)).catch(() => {});
        }}
      />}
      {!managerOpen && nodeMenu && menuNode && <LibraryNodeContextMenu
        key={`${menuNode.id}:${nodeMenu.x}:${nodeMenu.y}`}
        x={nodeMenu.x}
        y={nodeMenu.y}
        trigger={nodeMenu.trigger}
        nodeName={menuNode.name}
        disabled={busy || uploading}
        onClose={() => setNodeMenu(null)}
        onRename={() => { setRenaming(null); setRenamingNodeId(menuNode.id); }}
        onRemove={() => {
          if (window.confirm(`Remove “${menuNode.name}” from this library? Existing diagrams keep their image.`)) void action(() => nodeLibraryApi.deleteNode(menuNode.id)).catch(() => {});
        }}
      />}
      {managerOpen && <CustomLibrariesDialog
        sections={sections}
        loading={loadedOwner !== userId}
        busy={busy}
        uploading={uploading}
        error={error}
        onClose={() => setManagerOpen(false)}
        onCreateSection={async (name) => {
          let created: LibrarySection | undefined;
          await action(async () => {
            created = await nodeLibraryApi.createSection(name);
            const id = created.id;
            setExpanded((current) => ({ ...current, [id]: true }));
          });
          if (!created) throw new Error('Could not create the custom section.');
          return created;
        }}
        onRenameSection={(id, name) => action(() => nodeLibraryApi.updateSection(id, { name }))}
        onDeleteSection={(section) => action(() => nodeLibraryApi.deleteSection(section.id))}
        onReorderSection={(id, direction) => action(async () => {
          for (const update of reorderUpdates(sections, id, direction)) await nodeLibraryApi.updateSection(update.id, { sortOrder: update.sortOrder });
        })}
        onUpload={(section, files) => { void uploadFiles(section, files); }}
        renderNodes={(section) => <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          {section.nodes.map((node) => <LibraryNodeTile key={node.id} node={node} sections={sections} disabled={busy || uploading} inManager onAction={action} first={section.nodes[0]?.id === node.id} last={section.nodes.at(-1)?.id === node.id} onReorder={(direction) => action(async () => {
            for (const update of reorderUpdates(section.nodes, node.id, direction)) await nodeLibraryApi.updateNode(update.id, { sortOrder: update.sortOrder });
          })} />)}
        </div>}
        uploadStatus={uploadStatus}
        onRetry={retryLoading}
      />}
    </div>
  );
}
