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

- Module header/API contract: lines `1-22`
- Type model:
    - `EditorPage`: line `26`
    - `EditorState`: line `34`
- Internal constants/helpers:
    - `STORAGE_KEY`: line `41`
    - `savedPageSignaturesStore`: line `44`
    - `canvasDirtyPageIdsStore`: line `46`
    - `getPageSignature(...)`: line `49`
    - `buildPageSignatures(...)`: line `58`
    - `isEditorPage(...)`: line `66`
    - `isEditorState(...)`: line `79`
- Initial/default state:
    - `initialEditorState`: line `95`
    - `editorStoreSvelte`: line `108`
- Unsaved indicators:
    - `unsavedPageIdsStore`: line `111`
    - `visibleUnsavedPageIdsStore`: line `121`
    - `markCanvasDirtyPage(...)`: line `129`
    - `clearCanvasDirtyPage(...)`: line `134`
    - `clearAllCanvasDirtyPages(...)`: line `139`
- Storage I/O:
    - `saveActivePageToStorage(...)`: line `144`
    - `loadEditorStateFromStorage(...)`: line `187`
- Page/state mutation:
    - `switchPage(...)`: line `257`
    - `createPage(...)`: line `271`
    - `updateActiveGraph(...)`: line `302`
    - `renamePage(...)`: line `323`
    - `deletePage(...)`: line `338`
    - `activePageStore`: line `385`

### 2) Canvas Coordination

File: `src/lib/flow/Flow.svelte`

- Imports from store (sync + storage + dirty API): lines `57-70`
- Snapshot/clone/signature helpers:
    - `getActivePageSnapshot(...)`: line `125`
    - `cloneGraph(...)`: line `131`
    - `createCanvasSignature(...)`: line `170`
- Canvas baseline + dirty tracking state:
    - `canvasPageId`: line `184`
    - `baselineCanvasSignature`: line `185`
    - `isHydratingCanvas`: line `186`
- Explicit sync functions:
    - `persistCanvasToStore(...)`: line `356`
    - `hydrateCanvasFromStore(...)`: line `365`
    - `handleSwitchPage(...)`: line `388`
    - `handleCreatePage(...)`: line `396`
- Immediate dirty marker effect:
    - `$effect` marking/clearing dirty page: lines `852-873`
- On-load + save shortcut:
    - `onMount(...)`: line `876`
    - `Ctrl/Cmd + S` shortcut router: `src/lib/flow/keyboard-shortcuts.ts:37-40`
    - Save handler wiring: `Flow.svelte:895-897`
    - `handleSave(...)` storage save path: lines `435-438`
- Footer callback wiring:
    - `<EditorFooter onSwitchPage={...} onCreatePage={...} />`: line `1235`

### 3) Footer UI + Unsaved Dot

File: `src/lib/components/EditorFooter.svelte`

- Unsaved list import:
    - `visibleUnsavedPageIdsStore`: line `9`
- Switch/create handlers:
    - `handleCreatePage(...)`: line `37`
    - `handleSwitchPage(...)`: line `47`
- Inline name update:
    - `handlePageNameInput(...)`: line `62`
- Delete action:
    - `handleDeletePage(...)`: line `82`
- Dot render:
    - `{#if $visibleUnsavedPageIdsStore.includes(page.id)}`: line `116`
    - Inline red dot `<span>`: lines `117-123`

## Event Flows

### A) Switch Page

1. Footer calls `onSwitchPage(pageId)` in Flow (`Flow.svelte:388`)
2. Flow calls `persistCanvasToStore()` (`Flow.svelte:389`)
3. Flow calls `switchPage(pageId)` (`Flow.svelte:390`)
4. Flow calls `hydrateCanvasFromStore()` (`Flow.svelte:391`)

### B) Create Page

1. Footer calls `onCreatePage()` in Flow (`Flow.svelte:396`)
2. Flow persists current canvas (`Flow.svelte:397`)
3. Flow creates page (`Flow.svelte:398`)
4. Flow hydrates canvas from new active page (`Flow.svelte:399`)

### C) Save Active Page (`Ctrl/Cmd + S`)

1. Keyboard router intercepts shortcut (`keyboard-shortcuts.ts:37-40`)
2. Flow wires the save handler into the router (`Flow.svelte:895-897`)
3. Flow syncs canvas -> store (`Flow.svelte:436`)
4. Flow saves active page -> localStorage (`Flow.svelte:437`)
5. Store updates saved signature + clears canvas dirty marker (`editor.store.svelte.ts:178-182`)

### D) Load from Storage (On Mount)

1. Flow calls `loadEditorStateFromStorage()` (`Flow.svelte:877`)
2. Store validates payload and sets `editorStoreSvelte` (`editor.store.svelte.ts:198-204`)
3. Store rebuilds saved signatures + clears canvas dirty markers (`editor.store.svelte.ts:205-206`)
4. Flow hydrates canvas from new active page snapshot (`Flow.svelte:878`)

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
