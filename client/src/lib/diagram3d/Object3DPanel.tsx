'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Node } from '@xyflow/react';
import { ArrowDown, ArrowUp, Copy, Download, Trash2, Upload } from 'lucide-react';
import {
  MAX_VISUAL3D_PARTS,
  VISUAL3D_MATERIALS,
  VISUAL3D_SHAPES,
  cloneVisual3DPart,
  cloneVisual3DRecipe,
  isVisual3DRecipe,
  validateVisual3DRecipe,
  type Visual3DMaterial,
  type Visual3DPart,
  type Visual3DRecipe,
  type Visual3DShape,
  type Visual3DVector,
} from '@easydraw/diagram-schema';
import ColorField from '@/lib/components/ColorField';
import { beginGraphGesture, endGraphGesture, isGraphGestureActive } from '@/lib/flow/editor-commands';
import { nodeLibraryApi, type LibrarySection } from '@/lib/node-library/api';
import { IMAGE_STYLES_3D, imageStyleOf } from './icon-layout';
import { useObjectLibrary, type Object3DTemplate } from './object-library';
import { findDuplicate, duplicateNotice } from './duplicate-object';
import DuplicateObjectPrompt from './DuplicateObjectPrompt';
import { downloadObjectFile, pickObjectFile } from './object-files';

const BTN = 'rounded border border-line bg-white px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40';
const PRIMARY = 'rounded bg-mq-red px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-mq-red-hover disabled:opacity-40';
const SELECT = 'w-full rounded border border-line bg-white px-2 py-1.5 text-xs text-ink';
const SHAPE_LABEL: Record<Visual3DShape, string> = { box: 'Box', cylinder: 'Cylinder', sphere: 'Sphere', torus: 'Ring' };
const MATERIAL_LABEL: Record<Visual3DMaterial, string> = {
  body: 'Body (node fill colour)', frame: 'Frame', silver: 'Silver', dark: 'Dark', teal: 'Teal', blue: 'Blue', screen: 'Screen',
  amber: 'Amber', red: 'Red', green: 'Green', leaf: 'Leaf', wood: 'Wood', custom: 'Custom colour…',
};

/**
 * Slider that edits live while dragging and records one undo step per drag:
 * the first change opens a graph gesture, releasing the pointer closes it.
 */
function Slider({ label, value, min, max, step, onChange, format = (v) => v.toFixed(2) }: {
  label: string; value: number; min: number; max: number; step: number; onChange(value: number): void; format?(value: number): string;
}) {
  const finish = () => { if (isGraphGestureActive()) endGraphGesture(); };
  return <label className="flex items-center gap-2 text-xs text-ink-soft">
    <span className="w-14 shrink-0">{label}</span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value} className="min-w-0 flex-1 accent-mq-red"
      onChange={(event) => { if (!isGraphGestureActive()) beginGraphGesture(); onChange(Number(event.target.value)); }}
      onPointerUp={finish} onKeyUp={finish} onBlur={finish} />
    <span className="w-12 shrink-0 text-right tabular-nums text-ink-muted">{format(value)}</span>
  </label>;
}

function VectorSliders({ label, value, min, max, step, onChange, format }: {
  label: string; value: Visual3DVector; min: number; max: number; step: number; onChange(next: Visual3DVector): void; format?(value: number): string;
}) {
  const axes = ['X', 'Y', 'Z'] as const;
  return <div className="flex flex-col gap-1">
    <span className="text-[0.7rem] font-semibold tracking-wide text-ink-muted uppercase">{label}</span>
    {axes.map((axis, index) => <Slider key={axis} label={axis} value={value[index]!} min={min} max={max} step={step} format={format}
      onChange={(n) => { const next = [...value] as Visual3DVector; next[index] = n; onChange(next); }} />)}
  </div>;
}

const NEW_PART = (shape: Visual3DShape): Visual3DPart => ({ shape, material: 'custom', color: '#a6192e', size: [0.3, 0.3, 0.3], position: [0, 0, 0] });

const NEW_LIBRARY = '__new__';

/**
 * The Object tab of the style panel: design the node's 3D look part by part,
 * save it to one of the account's private libraries (the same ones that hold
 * image nodes), import or export it as JSON, or combine the current
 * multi-selection into one object. Image nodes choose the platform their
 * icon stands on, or use a library object as the base.
 */
export default function Object3DPanel({ node, selectedCount, disabled, onChange, onLiveChange, onCombine }: {
  node: Node;
  selectedCount: number;
  disabled: boolean;
  /** Recorded change (one undo step). */
  onChange(patch: Record<string, unknown>): void;
  /** Unrecorded change during a slider gesture; the gesture records it. */
  onLiveChange(patch: Record<string, unknown>): void;
  onCombine(): void;
}) {
  const recipe: Visual3DRecipe | null = isVisual3DRecipe(node.data.visual3d) ? node.data.visual3d : null;
  const parts = recipe?.parts ?? null;
  const isImage = node.type === 'CustomImageNode';
  const imageStyle = imageStyleOf(node.data, recipe);
  const [selectedPart, setSelectedPart] = useState(0);
  const templates = useObjectLibrary((s) => s.templates);
  const librariesVersion = useObjectLibrary((s) => s.librariesVersion);
  const library = useObjectLibrary();
  const [saveName, setSaveName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The private libraries objects are filed in; the sidebar owns their editing.
  const [sections, setSections] = useState<LibrarySection[] | null>(null);
  const [chosenSectionId, setChosenSectionId] = useState<string | null>(null);
  const [newLibraryName, setNewLibraryName] = useState<string | null>(null);
  // An import that matched an object the account already has, waiting on a decision.
  const [pendingImport, setPendingImport] = useState<{ name: string; recipe: Visual3DRecipe; library: string } | null>(null);

  useEffect(() => {
    if (templates === null) void useObjectLibrary.getState().load();
  }, [templates]);

  useEffect(() => {
    let cancelled = false;
    nodeLibraryApi.list().then((result) => { if (!cancelled) setSections(result.sections); }).catch(() => { if (!cancelled) setSections([]); });
    return () => { cancelled = true; };
  }, [librariesVersion]);

  // Default to the library holding most objects, so saves land where the starter set is.
  const defaultSectionId = useMemo(() => {
    if (!sections?.length) return null;
    const counts = new Map<string, number>();
    templates?.forEach((template) => counts.set(template.sectionId, (counts.get(template.sectionId) ?? 0) + 1));
    return [...sections].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0]!.id;
  }, [sections, templates]);
  const targetSectionId = chosenSectionId && sections?.some((section) => section.id === chosenSectionId) ? chosenSectionId : defaultSectionId;
  const sectionName = (id: string) => sections?.find((section) => section.id === id)?.name ?? 'library';

  const createLibrary = async () => {
    const name = newLibraryName?.trim();
    if (!name) return;
    try {
      const created = await nodeLibraryApi.createSection(name);
      setSections((current) => [...(current ?? []), created]);
      setChosenSectionId(created.id);
      setNewLibraryName(null);
      useObjectLibrary.getState().librariesChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create the library.');
    }
  };

  const setRecipe = (next: Visual3DRecipe | null) => onChange({ visual3d: next ?? undefined });
  const setParts = (next: Visual3DPart[], live = false) =>
    (live ? onLiveChange : onChange)({ visual3d: { ...(recipe ?? { version: 2 }), version: 2, parts: next } });
  const current = parts ? Math.min(selectedPart, parts.length - 1) : -1;
  const part = parts && current >= 0 ? parts[current]! : null;
  const updatePart = (patch: Partial<Visual3DPart>, live = false) => {
    if (!parts || !part) return;
    setParts(parts.map((p, i) => (i === current ? { ...cloneVisual3DPart(p), ...patch } : p)), live);
  };

  const startDesign = () => {
    setParts([NEW_PART('box')]);
    setSelectedPart(0);
  };

  const applyTemplate = (template: Object3DTemplate) => {
    const copy = cloneVisual3DRecipe(template.recipe);
    onChange({ visual3d: copy, ...(copy.fill && !node.data.fillColor ? { fillColor: copy.fill } : {}) });
    setSelectedPart(0);
  };

  const saveTemplate = async () => {
    if (!recipe || saveName === null || !targetSectionId) return;
    const name = saveName.trim();
    if (!name) return;
    try {
      await library.add(targetSectionId, name, recipe);
      setSaveName(null);
      setNotice(`Saved "${name}" to ${sectionName(targetSectionId)}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save the object.');
    }
  };

  /** Stores the object; reports any weaker overlap with what is already there. */
  const storeImport = async (name: string, recipe: Visual3DRecipe, overlap = true) => {
    if (!targetSectionId) return;
    try {
      const match = overlap ? findDuplicate(templates, name, recipe) : null;
      const created = await library.add(targetSectionId, name, recipe);
      setNotice(match
        ? duplicateNotice(match, sectionName(match.template.sectionId), created.name)
        : `Imported "${created.name}" into ${sectionName(targetSectionId)}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not import the object.');
    }
  };

  const importTemplate = async () => {
    if (!targetSectionId) { setNewLibraryName('3D objects'); return; }
    const file = await pickObjectFile();
    if (!file) return;
    const result = validateVisual3DRecipe(file.recipe);
    if (!result.valid) {
      setNotice(`Not a 3D object file: ${result.issues[0]?.message ?? 'invalid recipe'}`);
      return;
    }
    const recipe = file.recipe as Visual3DRecipe;
    const match = findDuplicate(templates, file.name, recipe);
    setNotice(null);
    // The same shape under another name is a legitimate variant; only the exact
    // same object stops to ask.
    if (match?.identical) {
      setPendingImport({ name: file.name, recipe, library: sectionName(match.template.sectionId) });
      return;
    }
    await storeImport(file.name, recipe);
  };

  const removeTemplate = async (template: Object3DTemplate) => {
    try {
      await library.remove(template.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete the object.');
    }
  };

  return <fieldset disabled={disabled || node.data.locked === true} className="flex min-w-0 flex-col gap-5 disabled:opacity-50">
    {selectedCount >= 2 && <div className="rounded-lg border border-mq-red/30 bg-mq-pink p-3 text-xs text-ink">
      <p className="font-semibold text-mq-maroon">{selectedCount} objects selected</p>
      <p className="mt-1 text-ink-soft">Combine them into one 3D object: each becomes a part, in its own colour, and their connections move to the new object. Labels are not kept.</p>
      <button type="button" className={`${PRIMARY} mt-2`} onClick={onCombine}>Combine into one object</button>
    </div>}

    {isImage && !recipe && <label className="text-xs text-ink-soft">Icon stands on
      <select className={`${SELECT} mt-1`} aria-label="Icon platform" value={imageStyle} onChange={(event) => onChange({ imageStyle3d: event.target.value })}>
        {IMAGE_STYLES_3D.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}
      </select>
    </label>}

    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] font-semibold tracking-wide text-ink-muted uppercase">{isImage ? 'Base under the icon' : '3D look'}</span>
        <span className="text-xs text-ink-muted">{parts ? `Custom · ${parts.length} part${parts.length === 1 ? '' : 's'}` : isImage ? 'Platform' : 'Original shape'}</span>
      </div>
      {!parts && <div className="flex flex-wrap gap-1">
        <button type="button" className={BTN} onClick={startDesign}>{isImage ? 'Design a custom base' : 'Design a 3D look'}</button>
      </div>}
      {parts && <div className="flex flex-wrap gap-1">
        <button type="button" className={BTN} onClick={() => { setRecipe(null); setSelectedPart(0); }}>{isImage ? 'Back to a platform' : 'Back to the original shape'}</button>
        <button type="button" className={BTN} onClick={() => recipe && downloadObjectFile(String(node.data.label || 'object'), recipe)}><Download size={13} className="mr-1 inline" />Export JSON</button>
      </div>}
      <p className="text-[0.7rem] leading-relaxed text-ink-muted">
        {isImage
          ? 'The icon turns to face the camera above its base. A base is a list of boxes, cylinders, spheres and rings; it scales with the node.'
          : 'A look is a list of boxes, cylinders, spheres and rings inside the object’s box; resize the object in Arrange or 3D and the look scales with it. Drop saved objects from the sidebar’s 3D objects section.'}
      </p>
    </div>

    {parts && <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[0.7rem] font-semibold tracking-wide text-ink-muted uppercase">Parts ({parts.length}/{MAX_VISUAL3D_PARTS})</span>
          <div className="flex gap-1">
            {VISUAL3D_SHAPES.map((shape) => <button key={shape} type="button" className={BTN} disabled={parts.length >= MAX_VISUAL3D_PARTS}
              onClick={() => { setParts([...parts, NEW_PART(shape)]); setSelectedPart(parts.length); }}>+ {SHAPE_LABEL[shape]}</button>)}
          </div>
        </div>
        <ul className="max-h-40 overflow-y-auto rounded border border-line bg-white" role="listbox" aria-label="Parts">
          {parts.map((p, index) => <li key={index}>
            <button type="button" role="option" aria-selected={index === current}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs ${index === current ? 'bg-mq-pink text-mq-maroon' : 'text-ink hover:bg-surface-hover'}`}
              onClick={() => setSelectedPart(index)}>
              <span className="inline-block size-3 rounded-sm border border-black/10" style={{ backgroundColor: p.material === 'custom' ? p.color : undefined }} />
              <span className="flex-1">{index + 1}. {SHAPE_LABEL[p.shape]}</span>
              <span className="text-ink-muted">{p.material === 'custom' ? p.color : p.material}</span>
            </button>
          </li>)}
        </ul>
        {part && <div className="flex items-center gap-1">
          <button type="button" className={BTN} aria-label="Move part up" disabled={current === 0} onClick={() => { const next = [...parts]; [next[current - 1], next[current]] = [next[current]!, next[current - 1]!]; setParts(next); setSelectedPart(current - 1); }}><ArrowUp size={14} /></button>
          <button type="button" className={BTN} aria-label="Move part down" disabled={current === parts.length - 1} onClick={() => { const next = [...parts]; [next[current + 1], next[current]] = [next[current]!, next[current + 1]!]; setParts(next); setSelectedPart(current + 1); }}><ArrowDown size={14} /></button>
          <button type="button" className={BTN} aria-label="Duplicate part" disabled={parts.length >= MAX_VISUAL3D_PARTS}
            onClick={() => { const copy = cloneVisual3DPart(part); copy.position = [copy.position[0] + 0.1, copy.position[1], copy.position[2]] as Visual3DVector; setParts([...parts.slice(0, current + 1), copy, ...parts.slice(current + 1)]); setSelectedPart(current + 1); }}><Copy size={14} /></button>
          <button type="button" className={`${BTN} ml-auto text-mq-red`} aria-label="Remove part" disabled={parts.length <= 1}
            onClick={() => { setParts(parts.filter((_, i) => i !== current)); setSelectedPart(Math.max(0, current - 1)); }}><Trash2 size={14} /></button>
        </div>}
      </div>

      {part && <div className="flex flex-col gap-3 rounded-lg border border-line-soft bg-white p-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-ink-soft">Shape
            <select className={`${SELECT} mt-1`} aria-label="Part shape" value={part.shape} onChange={(event) => updatePart({ shape: event.target.value as Visual3DShape })}>
              {VISUAL3D_SHAPES.map((shape) => <option key={shape} value={shape}>{SHAPE_LABEL[shape]}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-soft">Material
            <select className={`${SELECT} mt-1`} aria-label="Part material" value={part.material}
              onChange={(event) => { const material = event.target.value as Visual3DMaterial; updatePart(material === 'custom' ? { material, color: part.color ?? '#a6192e' } : { material }); }}>
              {VISUAL3D_MATERIALS.map((material) => <option key={material} value={material}>{MATERIAL_LABEL[material]}</option>)}
            </select>
          </label>
        </div>
        {part.material === 'custom' && <ColorField label="Part colour" value={part.color ?? '#a6192e'} onChange={(hex) => updatePart({ color: hex.toLowerCase() })} />}
        <VectorSliders label="Size" value={part.size} min={0.02} max={2} step={0.01} onChange={(size) => updatePart({ size }, true)} />
        <VectorSliders label="Position" value={part.position} min={-1} max={1} step={0.01} onChange={(position) => updatePart({ position }, true)} />
        <VectorSliders label="Rotation" value={(part.rotation ?? [0, 0, 0]).map((r) => (r * 180) / Math.PI) as Visual3DVector} min={-180} max={180} step={1}
          format={(v) => `${Math.round(v)}°`}
          onChange={(deg) => updatePart({ rotation: deg.map((d) => (d * Math.PI) / 180) as Visual3DVector }, true)} />
        {part.shape === 'cylinder' && <Slider label="Taper" value={part.taper ?? 1} min={0.1} max={2} step={0.01} onChange={(taper) => updatePart({ taper }, true)} />}
      </div>}
    </>}

    <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.7rem] font-semibold tracking-wide text-ink-muted uppercase">My 3D objects</span>
        <div className="flex flex-wrap gap-1">
          <button type="button" className={BTN} onClick={() => void importTemplate()}><Upload size={13} className="mr-1 inline" />Import JSON</button>
          {recipe && saveName === null && <button type="button" className={BTN} onClick={() => { setSaveName(String(node.data.label || '') || 'My object'); setNotice(null); if (!targetSectionId) setNewLibraryName('3D objects'); }}>Save this look…</button>}
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-soft">
        <span className="shrink-0">Library</span>
        <select className={SELECT} aria-label="Library to save into" value={newLibraryName !== null ? NEW_LIBRARY : targetSectionId ?? ''} disabled={sections === null}
          onChange={(event) => { if (event.target.value === NEW_LIBRARY) setNewLibraryName(''); else { setNewLibraryName(null); setChosenSectionId(event.target.value); } }}>
          {sections === null && <option value="">Loading…</option>}
          {sections?.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
          <option value={NEW_LIBRARY}>New library…</option>
        </select>
      </label>
      {newLibraryName !== null && <form className="flex gap-1" onSubmit={(event) => { event.preventDefault(); void createLibrary(); }}>
        <input className={`${SELECT} flex-1`} aria-label="New library name" placeholder="Library name" value={newLibraryName} maxLength={100} autoFocus onChange={(event) => setNewLibraryName(event.target.value)} />
        <button type="submit" className={PRIMARY} disabled={!newLibraryName.trim()}>Create</button>
        <button type="button" className={BTN} onClick={() => setNewLibraryName(null)}>Cancel</button>
      </form>}
      {saveName !== null && <form className="flex gap-1" onSubmit={(event) => { event.preventDefault(); void saveTemplate(); }}>
        <input className={`${SELECT} flex-1`} aria-label="Object name" value={saveName} maxLength={100} autoFocus onChange={(event) => setSaveName(event.target.value)} />
        <button type="submit" className={PRIMARY} disabled={!saveName.trim() || !targetSectionId}>Save</button>
        <button type="button" className={BTN} onClick={() => setSaveName(null)}>Cancel</button>
      </form>}
      {pendingImport && <DuplicateObjectPrompt
        name={pendingImport.name}
        library={pendingImport.library}
        onCancel={() => setPendingImport(null)}
        onImportAnyway={() => { const item = pendingImport; setPendingImport(null); void storeImport(item.name, item.recipe, false); }}
      />}
      {notice && <p className="text-xs text-ink-muted" role="status">{notice}</p>}
      {templates === null ? <p className="text-xs text-ink-muted">Loading…</p>
        : templates.length === 0 ? <p className="text-xs text-ink-muted">Nothing saved yet. Design a look and save it, or import a 3D object JSON file. Objects live in your private libraries in the sidebar.</p>
        : <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {templates.map((template) => <li key={template.id} className="flex items-center gap-1 rounded border border-line-soft bg-white px-2 py-1 text-xs">
            <span className="min-w-0 flex-1 truncate text-ink" title={`${template.name} — ${sectionName(template.sectionId)}`}>{template.name} <span className="text-ink-muted">· {sectionName(template.sectionId)}</span></span>
            <button type="button" className={BTN} onClick={() => applyTemplate(template)}>{isImage ? 'Use as base' : 'Apply'}</button>
            <button type="button" className={BTN} aria-label={`Download ${template.name}`} onClick={() => downloadObjectFile(template.name, template.recipe)}><Download size={13} /></button>
            <button type="button" className={`${BTN} text-mq-red`} aria-label={`Delete ${template.name}`} onClick={() => void removeTemplate(template)}><Trash2 size={13} /></button>
          </li>)}
        </ul>}
    </div>
  </fieldset>;
}
