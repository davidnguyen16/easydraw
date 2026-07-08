# Editor Store Integration Notes

## Scope

This document explains the current page/canvas/storage integration and lists the exact code locations that implement it.

All line numbers below are **as of this revision** and can drift after future edits.

## Architecture Summary

There are 3 distinct state layers:

1. Canvas-local state in `Flow.svelte` (`nodes`, `edges`)
2. In-memory app state in `editorStoreSvelte`
3. Persisted state in `localStorage` (`easydraw.editor.v1`)

The current behavior is intentionally explicit:

- Canvas does **not** continuously sync to store on every graph change.
- Canvas syncs to store at explicit moments (page switch/create and save shortcut).
- Storage sync happens on `Ctrl/Cmd + S`, and only for the active page.
- Full storage load happens once on mount.

## File/Section Map

### 1) Store Core

File: `src/lib/stores/editor.store.svelte.ts`

- Module header/API contract: lines `1-125`
- Type model:
    - `EditorPage`: line `132`
    - `EditorState`: line `140`
- Internal constants/helpers:
    - `STORAGE_KEY`: line `172`
    - `savedPageSignaturesStore`: line `175`
    - `canvasDirtyPageIdsStore`: line `177`
    - `getPageSignature(...)`: line `180`
    - `buildPageSignatures(...)`: line `189`
    - `isEditorPage(...)`: line `197`
    - `isEditorState(...)`: line `210`
- Initial/default state:
    - `initialEditorState`: line `222`
    - `editorStoreSvelte`: line `242`
- Unsaved indicators:
    - `unsavedPageIdsStore`: line `245`
    - `visibleUnsavedPageIdsStore`: line `255`
    - `markCanvasDirtyPage(...)`: line `263`
    - `clearCanvasDirtyPage(...)`: line `268`
    - `clearAllCanvasDirtyPages(...)`: line `273`
- Storage I/O:
    - `saveActivePageToStorage(...)`: line `278`
    - `loadEditorStateFromStorage(...)`: line `317`
- Page/state mutation:
    - `switchPage(...)`: line `337`
    - `createPage(...)`: line `351`
    - `updateActiveGraph(...)`: line `382`
    - `renamePage(...)`: line `403`
    - `deletePage(...)`: line `418`
    - `activePageStore`: line `439`

### 2) Canvas Coordination

File: `src/lib/flow/Flow.svelte`

- Imports from store (sync + storage + dirty API): lines `21-30`
- Snapshot/clone/signature helpers:
    - `getActivePageSnapshot(...)`: line `41`
    - `cloneGraph(...)`: line `47`
    - `createCanvasSignature(...)`: line `53`
- Canvas baseline + dirty tracking state:
    - `canvasPageId`: line `67`
    - `baselineCanvasSignature`: line `68`
    - `isHydratingCanvas`: line `69`
- Explicit sync functions:
    - `persistCanvasToStore(...)`: line `143`
    - `hydrateCanvasFromStore(...)`: line `152`
    - `handleSwitchPage(...)`: line `172`
    - `handleCreatePage(...)`: line `180`
- Immediate dirty marker effect:
    - `$effect` marking/clearing dirty page: lines `187-201`
- On-load + save shortcut:
    - `onMount(...)`: line `204`
    - `Ctrl/Cmd + S` storage save path: lines `209-215`
- Footer callback wiring:
    - `<EditorFooter onSwitchPage={...} onCreatePage={...} />`: line `256`

### 3) Footer UI + Unsaved Dot

File: `src/lib/components/EditorFooter.svelte`

- Unsaved list import:
    - `visibleUnsavedPageIdsStore`: line `9`
- Switch/create handlers:
    - `handleCreatePage(...)`: line `35`
    - `handleSwitchPage(...)`: line `45`
- Inline name update:
    - `handlePageNameInput(...)`: line `60`
- Delete action:
    - `handleDeletePage(...)`: line `78`
- Dot render:
    - `{#if $visibleUnsavedPageIdsStore.includes(page.id)}`: line `97`
    - `<span class="unsaved-dot" ...>`: line `98`
- Dot style:
    - `.unsaved-dot`: line `188`

## Event Flows

### A) Switch Page

1. Footer calls `onSwitchPage(pageId)` in Flow (`Flow.svelte:172`)
2. Flow calls `persistCanvasToStore()` (`Flow.svelte:143`)
3. Flow calls `switchPage(pageId)` (`Flow.svelte:174`)
4. Flow calls `hydrateCanvasFromStore()` (`Flow.svelte:175`)

### B) Create Page

1. Footer calls `onCreatePage()` in Flow (`Flow.svelte:180`)
2. Flow persists current canvas (`Flow.svelte:181`)
3. Flow creates page (`Flow.svelte:182`)
4. Flow hydrates canvas from new active page (`Flow.svelte:183`)

### C) Save Active Page (`Ctrl/Cmd + S`)

1. Flow intercepts shortcut (`Flow.svelte:209-213`)
2. Flow syncs canvas -> store (`Flow.svelte:214`)
3. Flow saves active page -> localStorage (`Flow.svelte:215`)
4. Store updates saved signature + clears canvas dirty marker (`editor.store.svelte.ts:281-286`)

### D) Load from Storage (On Mount)

1. Flow calls `loadEditorStateFromStorage()` (`Flow.svelte:205`)
2. Store validates payload and sets `editorStoreSvelte` (`editor.store.svelte.ts:296-303`)
3. Store rebuilds saved signatures + clears canvas dirty markers (`editor.store.svelte.ts:301-302`)
4. Flow hydrates canvas from new active page snapshot (`Flow.svelte:206`)

## Unsaved Indicator Rules

The dot appears when a page id exists in `visibleUnsavedPageIdsStore`.

A page is considered unsaved when either:

1. Store-vs-storage mismatch:
    - Page signature in `editorStoreSvelte` differs from saved signature (`unsavedPageIdsStore`)
2. Canvas-vs-store mismatch:
    - Active canvas diverges from baseline before explicit sync (`canvasDirtyPageIdsStore`)

So the dot can appear immediately on canvas edit, even before store sync.

## Current Non-Goals

- No `beforeunload` auto-save path yet (intentionally deferred).
- No continuous canvas->store sync on every graph change.
