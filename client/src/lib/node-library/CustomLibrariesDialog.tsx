'use client';

import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, FolderOpen, ImagePlus, LockKeyhole, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import type { LibrarySection } from './api';
import { CUSTOM_IMAGE_ACCEPT } from './library-utils';

export interface CustomLibrariesDialogProps {
  sections: LibrarySection[];
  loading: boolean;
  busy: boolean;
  uploading: boolean;
  error: string;
  onClose: () => void;
  onCreateSection: (name: string) => Promise<LibrarySection>;
  onRenameSection: (id: string, name: string) => Promise<void>;
  onDeleteSection: (section: LibrarySection) => Promise<void>;
  onReorderSection: (id: string, direction: -1 | 1) => Promise<void>;
  onUpload: (section: LibrarySection, files: File[]) => void;
  onImportFolder: (section: LibrarySection) => void;
  renderNodes: (section: LibrarySection) => ReactNode;
  uploadStatus: ReactNode;
  onRetry: () => void;
}

const BUILT_IN_SECTIONS = ['Basic', 'Arrows', 'Flowchart', 'Entity Relation', 'UML'] as const;
const HEADING = 'm-0 text-sm font-semibold tracking-[0.07em] text-[#786b60]';
const INPUT = 'h-[46px] min-w-0 rounded-md border border-[#d7cfc7] bg-white px-3 text-lg text-[#302923] outline-none placeholder:text-[#a89a8d] focus:border-[#9f1c35] focus:ring-2 focus:ring-[#9f1c35]/10 disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_BUTTON = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-[#d7cfc7] bg-white px-2.5 py-1.5 text-xs font-medium text-[#66584d] transition-colors hover:border-[#9f1c35] hover:text-[#9f1c35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9f1c35] disabled:cursor-not-allowed disabled:opacity-40';
const PRIMARY_BUTTON = 'inline-flex h-[46px] shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#9f1c35] bg-[#a51c36] px-4 text-lg font-semibold text-white transition-colors hover:bg-[#89172d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9f1c35] disabled:cursor-not-allowed disabled:border-[#c98d99] disabled:bg-[#c98d99] disabled:text-white';

export default function CustomLibrariesDialog({
  sections,
  loading,
  busy,
  uploading,
  error,
  onClose,
  onCreateSection,
  onRenameSection,
  onDeleteSection,
  onReorderSection,
  onUpload,
  onImportFolder,
  renderNodes,
  uploadStatus,
  onRetry,
}: CustomLibrariesDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const newSectionInput = useRef<HTMLInputElement>(null);
  const multipleInput = useRef<HTMLInputElement>(null);
  const singleInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [localError, setLocalError] = useState('');
  const [dropTarget, setDropTarget] = useState<'multiple' | 'single' | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Selection never points to a removed or built-in section. A fresh modal can
  // immediately use the first private section; creating one selects that one.
  const selected = sections.find((section) => section.id === selectedId) ?? sections[0] ?? null;
  const selectedIndex = selected ? sections.findIndex((section) => section.id === selected.id) : -1;
  const disabled = loading || busy || uploading || pendingAction !== null;
  const uploadDisabled = disabled || !selected;
  const displayedError = localError || error;

  useEffect(() => {
    mounted.current = true;
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    newSectionInput.current?.focus();
    return () => {
      mounted.current = false;
      if (element?.open) element.close();
    };
  }, []);

  const close = () => {
    // Closing remains available during a transfer; the owner retains the S3
    // upload and status. Native close restores focus to the opening button.
    mounted.current = false;
    dialog.current?.close();
    onClose();
  };

  const runAction = async (kind: string, operation: () => Promise<void>) => {
    if (disabled || pending.current) return;
    pending.current = true;
    setPendingAction(kind);
    setLocalError('');
    try { await operation(); }
    catch (failure) {
      if (mounted.current) setLocalError(failure instanceof Error ? failure.message : 'Could not update this library. Please try again.');
    } finally {
      pending.current = false;
      if (mounted.current) setPendingAction(null);
    }
  };

  const createSection = (event: FormEvent) => {
    event.preventDefault();
    const name = newSectionName.trim();
    if (!name || name.length > 100) return;
    void runAction('create', async () => {
      const created = await onCreateSection(name);
      if (!mounted.current) return;
      setSelectedId(created.id);
      setNewSectionName('');
      setRenameId(null);
    });
  };

  const renameSection = (event: FormEvent) => {
    event.preventDefault();
    const name = renameValue.trim();
    if (!selected || renameId !== selected.id || !name || name.length > 100) return;
    void runAction('rename', async () => {
      await onRenameSection(selected.id, name);
      if (mounted.current) setRenameId(null);
    });
  };

  const upload = (files: File[], multiple: boolean) => {
    if (uploadDisabled || !selected || !files.length) return;
    setLocalError('');
    onUpload(selected, multiple ? files : files.slice(0, 1));
  };

  const handleDrop = (event: DragEvent<HTMLElement>, multiple: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    upload(Array.from(event.dataTransfer.files), multiple);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>, target: 'multiple' | 'single') => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = uploadDisabled ? 'none' : 'copy';
    if (!uploadDisabled) setDropTarget(target);
  };

  const dropzoneClass = (target: 'multiple' | 'single') =>
    `flex flex-col items-center justify-center rounded-lg border border-dashed px-5 text-center transition-colors ${dropTarget === target ? 'border-[#a51c36] bg-[#f8eeee]' : 'border-[#d3cdc6] bg-[#fbfaf9]'}`;

  return (
    <dialog
      ref={dialog}
      aria-label="Custom node libraries"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[840px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[10px] border border-[#d8cec5] bg-[#faf8f6] p-5 text-[#352b24] shadow-[0_24px_90px_rgba(0,0,0,0.3)] backdrop:bg-black/45 sm:p-[30px]"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onKeyDown={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Close custom libraries"
        className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-md border-none bg-transparent text-[#938678] hover:bg-[#eee7df] hover:text-[#4c3a30] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9f1c35] sm:top-5 sm:right-5"
        onClick={close}
      >
        <X size={19} strokeWidth={1.8} aria-hidden="true" />
      </button>

      <header className="mb-5 pr-8">
        <h2 id={titleId} className="m-0 text-[23px] leading-tight font-semibold tracking-[-0.02em] text-[#302720]">Custom node libraries</h2>
        <p id={descriptionId} className="mt-1 mb-0 max-w-[700px] text-lg leading-relaxed text-[#8c7f72]">Create your own sections, then upload nodes into the section you choose.</p>
      </header>

      {displayedError && <div className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-[#ddb5bb] bg-[#f9eff0] px-3 py-2 text-xs text-[#942037]" role="alert">
        <p className="m-0 min-w-0 flex-1 break-words">{displayedError}</p>
        <button type="button" className={SECONDARY_BUTTON} disabled={disabled} onClick={() => { setLocalError(''); onRetry(); }}>Retry</button>
      </div>}

      <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[minmax(0,275px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-7">
          <section aria-label="Built-in sections">
            <h3 className={HEADING}>BUILT-IN SECTIONS</h3>
            <div className="mt-3 flex flex-col gap-[5px]">
              {BUILT_IN_SECTIONS.map((name) => <button key={name} type="button" disabled className="flex h-[46px] w-full cursor-not-allowed items-center justify-between rounded-md border border-[#e4dfda] bg-[#efedeb] px-3 text-left text-lg text-[#3c3734]">
                <span>{name}</span><LockKeyhole size={13} strokeWidth={1.7} aria-hidden="true" />
              </button>)}
            </div>
            <p className="mt-3 mb-0 text-sm leading-relaxed text-[#a09487]">Built-in sections are locked.</p>
          </section>

          <section aria-label="Your custom sections">
            <h3 className={HEADING}>YOUR SECTIONS</h3>
            {loading ? <p className="mt-3 mb-0 text-sm text-[#96897b]" role="status">Loading your sections…</p> : sections.length === 0 ? <p className="mt-3 mb-0 rounded-md border border-dashed border-[#d8cfc6] p-[14px] text-sm text-[#a49688]">No custom sections yet.</p> : <div className="mt-3 flex max-h-[235px] flex-col gap-2 overflow-y-auto pr-0.5">
              {sections.map((section) => <button
                type="button"
                key={section.id}
                aria-label={`Select ${section.name}`}
                aria-pressed={selected?.id === section.id}
                disabled={disabled}
                className={`flex min-h-10 min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-left text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9f1c35] disabled:cursor-not-allowed disabled:opacity-60 ${selected?.id === section.id ? 'border-[#cfa4ab] bg-[#f7e9eb] text-[#96233a]' : 'border-[#e1d8cf] bg-white text-[#67594b] hover:border-[#c8a8a9]'}`}
                onClick={() => { setSelectedId(section.id); setRenameId(null); }}
              >
                <FolderOpen size={16} strokeWidth={1.7} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 break-words">{section.name}</span>
                <span className="shrink-0 text-[11px] text-[#a49385]">{section.nodes.length}</span>
              </button>)}
            </div>}

            {selected && <div className="mt-3 flex flex-col gap-2">
              {renameId === selected.id ? <form className="flex flex-col gap-2" onSubmit={renameSection}>
                <label className="flex flex-col gap-1 text-xs text-[#77685b]">Section name<input className={INPUT} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={100} required disabled={disabled} /></label>
                <div className="flex gap-2"><button type="submit" className={SECONDARY_BUTTON} disabled={disabled || !renameValue.trim()}>Save name</button><button type="button" className={SECONDARY_BUTTON} disabled={disabled} onClick={() => setRenameId(null)}>Cancel</button></div>
              </form> : <div className="flex flex-wrap gap-1.5">
                <button type="button" className={SECONDARY_BUTTON} disabled={disabled} onClick={() => { setRenameId(selected.id); setRenameValue(selected.name); }}><Pencil size={12} aria-hidden="true" />Rename</button>
                <button type="button" className={SECONDARY_BUTTON} disabled={disabled} onClick={() => {
                  if (window.confirm(`Remove section “${selected.name}” and its library entries? Existing diagrams keep their images.`)) void runAction('delete', () => onDeleteSection(selected));
                }}><Trash2 size={12} aria-hidden="true" />Remove</button>
                <button type="button" className={SECONDARY_BUTTON} aria-label={`Move ${selected.name} up`} disabled={disabled || selectedIndex <= 0} onClick={() => void runAction('reorder', () => onReorderSection(selected.id, -1))}><ArrowUp size={13} aria-hidden="true" /></button>
                <button type="button" className={SECONDARY_BUTTON} aria-label={`Move ${selected.name} down`} disabled={disabled || selectedIndex >= sections.length - 1} onClick={() => void runAction('reorder', () => onReorderSection(selected.id, 1))}><ArrowDown size={13} aria-hidden="true" /></button>
              </div>}
            </div>}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section>
            <h3 className={HEADING}>CREATE A CUSTOM SECTION</h3>
            <form className="mt-3 flex min-w-0 gap-2" onSubmit={createSection}>
              <input ref={newSectionInput} autoFocus aria-label="New custom section name" placeholder="e.g. My AWS nodes" className={`${INPUT} flex-1`} value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} maxLength={100} required disabled={disabled} />
              <button type="submit" className={PRIMARY_BUTTON} disabled={disabled || !newSectionName.trim()}><Plus size={16} strokeWidth={2} aria-hidden="true" />{pendingAction === 'create' ? 'Adding…' : 'Add'}</button>
            </form>
          </section>

          <section
            className={`${dropzoneClass('multiple')} min-h-[202px] py-4`}
            aria-label="Upload multiple custom nodes"
            onDragOver={(event) => handleDragOver(event, 'multiple')}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(event) => handleDrop(event, true)}
          >
            <Upload size={28} strokeWidth={1.3} className="mb-2 text-[#a69b90]" aria-hidden="true" />
            <h3 className="m-0 text-lg font-medium text-[#62564c]">Upload custom nodes</h3>
            <p className="mt-2 mb-3 max-w-[340px] text-sm leading-relaxed text-[#9c9186]">{selected ? <>Upload into <span className="font-medium text-[#786554]">{selected.name}</span>. Drag images here or choose files.</> : 'Create or select a custom section first.'}</p>
            <button type="button" className="inline-flex h-11 items-center justify-center rounded-md border border-[#d9d0c6] bg-[#faf8f5] px-4 text-lg text-[#796c5f] hover:border-[#a51c36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9f1c35] disabled:cursor-not-allowed disabled:border-[#ddd5cc] disabled:bg-[#faf8f5] disabled:text-[#b2a497]" disabled={uploadDisabled} onClick={() => multipleInput.current?.click()}>Choose files</button>
            <input ref={multipleInput} type="file" className="hidden" aria-label="Upload images to selected library" accept={CUSTOM_IMAGE_ACCEPT} multiple disabled={uploadDisabled} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; upload(files, true); }} />
          </section>

          <section>
            <h3 className={HEADING}>UPLOAD CUSTOM NODE</h3>
            <div
              className={`${dropzoneClass('single')} mt-3 min-h-[160px] py-4`}
              onDragOver={(event) => handleDragOver(event, 'single')}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(event) => handleDrop(event, false)}
            >
              <button type="button" className="inline-flex flex-col items-center gap-2 rounded-md border-none bg-transparent px-5 py-1 text-lg font-normal text-[#82776c] hover:text-[#9f1c35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9f1c35] disabled:cursor-not-allowed disabled:text-[#b0a395]" disabled={uploadDisabled} onClick={() => singleInput.current?.click()}>
                <ImagePlus size={29} strokeWidth={1.3} aria-hidden="true" /><span>Choose an image</span>
              </button>
              <p className="mt-1 mb-0 text-sm text-[#b1a79b]">PNG, JPG, SVG or WebP</p>
              <input ref={singleInput} type="file" className="hidden" aria-label="Upload a custom node image" accept={CUSTOM_IMAGE_ACCEPT} disabled={uploadDisabled} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; upload(files, false); }} />
            </div>
            {!selected && <p className="mt-2 mb-0 text-sm text-[#a79b8e]">Select or create a private section first.</p>}
          </section>

          <section>
            <h3 className={HEADING}>3D OBJECTS</h3>
            <p className="mt-2 mb-3 text-sm leading-relaxed text-[#9c9186]">Preview a folder of 3D objects, then select which ones to import.</p>
            <button type="button" className={SECONDARY_BUTTON} disabled={uploadDisabled}
              aria-label={selected ? `Import a 3D folder into ${selected.name}` : 'Import a 3D folder'}
              onClick={() => { if (selected) onImportFolder(selected); }}><FolderOpen size={16} />+ Import 3D folder</button>
          </section>
          {selected && selected.nodes.length > 0 && <section aria-label={`Nodes in ${selected.name}`} className="min-w-0 border-t border-[#e5dcd3] pt-4">
            <h3 className={`${HEADING} mb-3 break-words`}>{selected.name}</h3>
            {renderNodes(selected)}
          </section>}
          {uploadStatus}
          {uploading && <p className="m-0 text-[11px] leading-relaxed text-[#968675]">You can close this window while your images finish uploading.</p>}
        </div>
      </div>
    </dialog>
  );
}
