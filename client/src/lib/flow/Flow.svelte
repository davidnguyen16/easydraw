<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { nanoid } from 'nanoid';
	import {
		SvelteFlow,
		Background,
		BackgroundVariant,
		useSvelteFlow,
		addEdge,
		type Node,
		type Edge,
		type NodeEventWithPointer,
		ConnectionMode,
		type Connection,
		type OnConnectEnd
	} from '@xyflow/svelte';
	import { get } from 'svelte/store';

	import { useDnD } from '$lib/flow/DnDProvider.svelte';
	import Sidebar from '$lib/components/sidebar/Sidebar.svelte';

	import ConnectionStylePanel from '$lib/components/ConnectionStylePanel.svelte';
	import StylePanel, { type NodeStyleData } from '$lib/components/style-panel/StylePanel.svelte';
	import { EXPORTERS, getExporter } from '$lib/exporters';
	import ConnectionEdge from '$lib/flow/edges/ConnectionEdge.svelte';
	import ConnectionLinePreview from '$lib/flow/edges/ConnectionLinePreview.svelte';
	import { buildNodeTypesMap, getShape } from '$lib/flow/nodes/registry';
	import AnchorNode from '$lib/flow/nodes/anchor/AnchorNode.svelte';
	import {
		ANCHOR_HANDLE_ID,
		ANCHOR_NODE_TYPE,
		createAnchorNode
	} from '$lib/flow/nodes/anchor/anchor';
	import {
		bringSelectedForward,
		bringSelectedToFront,
		copySelection,
		deleteSelectedGraph,
		duplicateSelectedNodes,
		groupSelectedNodes,
		pasteSnapshot,
		selectAllGraph,
		sendSelectedBackward,
		sendSelectedToBack,
		toggleNodeLock,
		ungroupSelectedNodes,
		type ClipboardSnapshot
	} from '$lib/flow/graph-actions';
	import { createEditorKeyboardHandler } from '$lib/flow/keyboard-shortcuts';

	import EditorFooter from '$lib/components/EditorFooter.svelte';
	import MenuBar from '$lib/components/MenuBar.svelte';
	import ToolBar from '$lib/components/ToolBar.svelte';
	import CanvasScrollbars from '$lib/flow/CanvasScrollbars.svelte';
	import ContextMenu from '$lib/flow/ContextMenu.svelte';
	import {
		clearCanvasDirtyPage,
		createPage,
		deleteAllPages,
		deletePage,
		duplicatePage,
		editorMetaData,
		editorStoreSvelte,
		exportEditorStateAsJSON,
		loadEditorStateFromJSON,
		markCanvasDirtyPage,
		resetEditorState,
		saveActivePageToStorage,
		saveFullStateToStorage,
		switchPage,
		updateActiveGraph,
		visibleUnsavedPageIdsStore
	} from '$lib/stores/editor.store.svelte';
	import {
		historyState,
		recordSnapshot,
		resetHistory,
		undo as historyUndo,
		redo as historyRedo
	} from '$lib/stores/history.store.svelte';

	import { API_URL } from '$lib/api';
	import { page } from '$app/state';

	// xy-theme.css is our customised copy of @xyflow/svelte's default
	// stylesheet — imported instead of the upstream `dist/style.css`.
	import '../../xy-theme.css';

	setContext('updateNode', (id: string, data: any) => updateNodeData(id, data));

	// Lets the connection edge create a floating-endpoint anchor during an
	// endpoint reconnect drag (the edge component can't add nodes itself — only
	// Flow owns the `nodes` array). Returns the new anchor's id so the edge can
	// repoint its end onto it. Orphaned anchors are swept by the prune effect.
	setContext('addAnchorNode', (position: { x: number; y: number }): string => {
		const id = nanoid();
		nodes = [...nodes, createAnchorNode(id, position)];
		return id;
	});

	// A connection label swallows pointer events (so a click on the text doesn't
	// drag the line), which means editing a label never selects its edge through
	// xyflow. Without a selected edge the toolbar font / size / colour controls
	// have nothing to target. So when a label enters edit mode the edge calls
	// this to make ITSELF the sole selection — clearing any node/other-edge
	// selection so it wins the toolbar's style target, and staying selected after
	// the editor blurs (e.g. when the user clicks a toolbar control).
	setContext('selectEdgeForStyling', (edgeId: string) => {
		nodes = nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
		edges = edges.map((e) => ({ ...e, selected: e.id === edgeId }));
	});

	// Moves a fully-floating connection (both ends on anchors) as ONE rigid
	// object. Flow owns the raw nodes/edges arrays, so both endpoint anchors
	// and the edge's bend points update here in a single callback — one tick,
	// so no frame renders with the body moved but an endpoint left behind, and
	// the canvas dirty-tracking sees the change like any other graph edit.
	setContext(
		'moveFloatingConnection',
		(update: {
			edgeId: string;
			sourceId: string;
			sourcePosition: { x: number; y: number };
			targetId: string;
			targetPosition: { x: number; y: number };
			bendPoints: { x: number; y: number }[];
		}) => {
			nodes = nodes.map((node) => {
				if (node.id === update.sourceId)
					return { ...node, position: update.sourcePosition };
				if (node.id === update.targetId)
					return { ...node, position: update.targetPosition };
				return node;
			});
			edges = edges.map((edge) =>
				edge.id === update.edgeId
					? { ...edge, data: { ...edge.data, bendPoints: update.bendPoints } }
					: edge
			);
		}
	);

	// Palette node types come from the shape registry. The connection anchor
	// is an INTERNAL type (floating edge endpoints) — never a palette shape —
	// so it's merged in here rather than added to the sidebar registry. New
	// internal-only node types follow this same merge pattern.
	const nodeTypes = {
		...buildNodeTypesMap(),
		[ANCHOR_NODE_TYPE]: AnchorNode
	};

	// `connection` is the general-purpose orthogonal edge with rounded
	// corners and draggable bend pills — the only edge type in the editor.
	const edgeTypes = {
		connection: ConnectionEdge
	};

	// Returns the active page snapshot from editor store.
	const getActivePageSnapshot = () => {
		const state = get(editorStoreSvelte);
		return state.pages.find((page) => page.id === state.activePageId) ?? state.pages[0] ?? null;
	};

	// Deep-clones graph arrays so canvas edits do not mutate store by reference.
	const cloneGraph = <T,>(items: T[]) => {
		return typeof structuredClone === 'function'
			? structuredClone(items)
			: (JSON.parse(JSON.stringify(items)) as T[]);
	};

	// Clones nodes and also re-attaches the onEdit callback to each node's data, since functions cannot be cloned.
	// onEdit must be stripped BEFORE structuredClone — structuredClone throws a DataCloneError on function values,
	// whereas JSON.stringify would silently drop them. Stripping first lets structuredClone deep-clone everything
	// else safely; the map below re-attaches a fresh onEdit closure after cloning.
	const cloneNodes = (items: Node[]): Node[] => {
		const serializable = items.map((n) => {
			const { onEdit: _drop, ...safeData } = (n.data ?? {}) as any;
			return { ...n, data: safeData };
		});

		const cloned =
			typeof structuredClone === 'function'
				? structuredClone(serializable)
				: (JSON.parse(JSON.stringify(serializable)) as Node[]);

		return cloned.map((n) => {
			// Per-node lock lives in data.locked (so it persists), but the
			// interactivity flags that enforce it (draggable/connectable/
			// deletable) are node props, not data — re-derive them on hydrate so
			// a locked node stays locked after reload / page switch.
			const locked = !!(n.data as any)?.locked;
			return {
				...n,
				...(locked ? { draggable: false, connectable: false, deletable: false } : {}),
				data: {
					...n.data,
					onEdit: (newData: any) => updateNodeData(n.id, newData)
				}
			};
		}) as Node[];
	};

	// Creates a stable signature for dirty-checking canvas graph state.
	const createCanvasSignature = (currentNodes: Node[], currentEdges: Edge[]) => {
		return JSON.stringify({
			nodes: currentNodes,
			edges: currentEdges
		});
	};

	const initialPage = getActivePageSnapshot();
	const initialNodes = cloneNodes(initialPage?.nodes ?? ([] as Node[]));
	const initialEdges = cloneGraph(initialPage?.edges ?? ([] as Edge[]));

	// Local graph state used by SvelteFlow bindings.
	let nodes = $state.raw(initialNodes);
	let edges = $state.raw(initialEdges);
	let canvasPageId: string | null = $state(initialPage?.id ?? null);
	let baselineCanvasSignature = $state(createCanvasSignature(initialNodes, initialEdges));
	let isHydratingCanvas = $state(false);
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
	let savedMetaSignature: string | null = null;
	let saveGeneration = 0;

	// Set true while undo/redo is restoring a snapshot, so the resulting
	// nodes/edges change does NOT push another snapshot onto the history stack.
	let isApplyingHistory = $state(false);
	let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Hidden file input ref used by File > Open in MenuBar / Open icon in ToolBar.
	// Definitely assigned via bind:this once the template mounts.
	let fileInput!: HTMLInputElement;

	// Reactive state shared with MenuBar / ToolBar via the `editor` context.
	const editorActionsState = $state({
		zoomPercent: 100,
		showGrid: true,
		snapToGrid: false,
		locked: false,
		showStylePanel: true,
		saveStatus: 'saved' as 'saved' | 'saving' | 'error',
		// Present mode: hides all editor chrome (menubar/toolbar/sidebar/panels/
		// footer) and shows just the canvas, read-only. Toggled by the menubar's
		// Present button; Esc exits.
		presenting: false
	});

	// In-memory clipboard for Copy / Paste. JSON-clean (no function refs).
	let clipboardSnapshot: ClipboardSnapshot | null = null;

	// Successive pastes cascade diagonally so each Ctrl+V lands offset from the
	// previous one (and from the originals) instead of stacking on the same spot
	// — that way it's obvious a new copy appeared. Reset on every fresh copy.
	let pasteCount = 0;

	// Default text style applied to newly-dropped nodes. Editable from the
	// toolbar font / size / B / I / U / colour controls WHEN NOTHING IS SELECTED
	// (the toolbar targets this instead of no-op-ing), so a font/size can be
	// chosen up front and every new node inherits it. Session-scoped.
	const defaultTextStyle = $state({
		fontFamily: 'Inter',
		fontSize: 14,
		bold: false,
		italic: false,
		underline: false,
		textColor: '#2c2c2a'
	});

	// Keep the full hook return so method lookups happen at call time. xyflow
	// returns `zoomIn`/`zoomOut` as direct property captures (not lazy wrappers
	// like `fitView` is) — destructuring them at init time was firing a stale
	// no-op when invoked through the menu, even though the toolbar happened
	// to work.
	const flow = useSvelteFlow();

	const type = useDnD();

	const defaultEdgeOptions = {
		type: 'connection'
	};

	// Drag and drop behavior. When locked, we skip preventDefault so the
	// browser refuses the drop, and show a 'none' cursor for feedback.
	const onDragOver = (event: DragEvent) => {
		if (editorActionsState.locked) {
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
			return;
		}
		event.preventDefault();

		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	};

	const onDrop = (event: DragEvent) => {
		if (editorActionsState.locked) return;
		event.preventDefault();

		if (!type.current) {
			return;
		}

		// Resolve the dropped tile against the shape registry — unknown ids
		// (e.g. a stale palette tile) get silently ignored rather than dropping
		// a malformed node onto the canvas.
		const shape = getShape(type.current);
		if (!shape) return;

		const position = flow.screenToFlowPosition({
			x: event.clientX,
			y: event.clientY
		});

		// Connection-preset tiles (e.g. ERD cardinalities) drop a free-floating
		// CONNECTION — two anchor endpoints + one `connection` edge — exactly
		// like detaching both ends of a connection. Both anchors and the edge
		// land in the same tick so the orphan-anchor prune effect always sees
		// them referenced. The edge drops selected so ConnectionStylePanel
		// opens on it right away; grabbing its body rigid-moves it as one.
		if (shape.edgePreset) {
			const preset = shape.edgePreset(position);
			const sourceId = nanoid();
			const targetId = nanoid();
			nodes = [
				...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
				createAnchorNode(sourceId, preset.source),
				createAnchorNode(targetId, preset.target)
			];
			edges = [
				...edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
				{
					id: nanoid(),
					type: 'connection',
					source: sourceId,
					sourceHandle: ANCHOR_HANDLE_ID,
					target: targetId,
					targetHandle: ANCHOR_HANDLE_ID,
					data: { bendPoints: [], ...preset.data },
					selected: true
				} as Edge
			];
			return;
		}

		const nodeData = shape.defaultData();
		const newNodeId = nanoid();

		// Shapes whose identity depends on aspect ratio (Circle, Ellipse, …)
		// declare defaultWidth/Height so they drop with the right bounding
		// box rather than xyflow's content-driven default. When omitted, the
		// node sizes itself like before.
		const hasDefaultSize =
			shape.defaultWidth !== undefined && shape.defaultHeight !== undefined;

		const newNode = {
			id: newNodeId,
			type: type.current,
			position,
			data: {
				// Seed the current default text style so new nodes inherit the
				// font / size / etc. chosen in the toolbar with nothing selected.
				fontFamily: defaultTextStyle.fontFamily,
				fontSize: defaultTextStyle.fontSize,
				bold: defaultTextStyle.bold,
				italic: defaultTextStyle.italic,
				underline: defaultTextStyle.underline,
				textColor: defaultTextStyle.textColor,
				...nodeData,
				onEdit: (newData: any) => updateNodeData(newNodeId, newData)
			},
			origin: [0.5, 0.0],
			...(hasDefaultSize
				? {
						width: shape.defaultWidth,
						height: shape.defaultHeight,
						style: `width: ${shape.defaultWidth}px; height: ${shape.defaultHeight}px;`
					}
				: {})
		} satisfies Node;

		nodes = [...nodes, newNode];
	};

	// Context Menu
	let menu: {
		id: string;
		top?: number;
		left?: number;
		right?: number;
		bottom?: number;
	} | null = $state(null);
	let clientWidth: number = $state(0);
	let clientHeight: number = $state(0);

	const handleContextMenu: NodeEventWithPointer<MouseEvent> = ({ event, node }) => {
		// Prevent native context menu from showing
		event.preventDefault();

		// Right-clicking a node that isn't already part of the selection makes
		// it the selection, so the menu's (selection-based) actions target it.
		// A right-click inside an existing multi-selection keeps that selection.
		const target = nodes.find((n) => n.id === node.id);
		if (target && !target.selected) {
			nodes = nodes.map((n) => ({ ...n, selected: n.id === node.id }));
			edges = edges.map((e) => ({ ...e, selected: false }));
		}

		// Calculate position of the context menu. We want to make sure it
		// doesn't get positioned off-screen.
		menu = {
			id: node.id,
			top: event.clientY < clientHeight - 200 ? event.clientY : undefined,
			left: event.clientX < clientWidth - 200 ? event.clientX : undefined,
			right: event.clientX >= clientWidth - 200 ? clientWidth - event.clientX : undefined,
			bottom: event.clientY >= clientHeight - 200 ? clientHeight - event.clientY : undefined
		};
	};

	// Close the context menu if it's open whenever the window is clicked.
	function handlePaneClick() {
		menu = null;
	}

	// Persists the current canvas graph into the active page in store.
	function persistCanvasToStore() {
		updateActiveGraph(nodes, edges);
		baselineCanvasSignature = createCanvasSignature(nodes, edges);
		if (canvasPageId) {
			clearCanvasDirtyPage(canvasPageId);
		}
	}

	// Loads the active page graph from store into canvas state.
	function hydrateCanvasFromStore() {
		const activePage = getActivePageSnapshot();
		const nextNodes = cloneNodes(activePage?.nodes ?? []);
		const nextEdges = cloneGraph(activePage?.edges ?? []);

		isHydratingCanvas = true;
		nodes = nextNodes;
		edges = nextEdges;
		canvasPageId = activePage?.id ?? null;
		baselineCanvasSignature = createCanvasSignature(nextNodes, nextEdges);
		if (canvasPageId) {
			clearCanvasDirtyPage(canvasPageId);
		}

		// Reset undo/redo history each time we swap into a different page snapshot.
		resetHistory(baselineCanvasSignature);

		queueMicrotask(() => {
			isHydratingCanvas = false;
		});
	}

	// Switches page with explicit two-step sync: persist old page, then hydrate new page.
	function handleSwitchPage(pageId: string) {
		persistCanvasToStore();
		switchPage(pageId);
		hydrateCanvasFromStore();
		handlePaneClick();
	}

	// Creates a new page and hydrates its graph into canvas.
	function handleCreatePage() {
		persistCanvasToStore();
		createPage();
		hydrateCanvasFromStore();
		handlePaneClick();
	}

	// Deletes a page and ensures both the canvas and localStorage stay consistent.
	//
	// Why this can't just call deletePage() directly from EditorFooter:
	//   1. If the deleted page is the currently active one, the canvas still holds
	//      its nodes/edges — we need to hydrate the newly-active page immediately
	//      so the user sees the right content and future Cmd+S saves correct data.
	//   2. deletePage() only mutates the in-memory store; the deleted page stays
	//      in localStorage until we explicitly overwrite it. Without this handler,
	//      a page refresh would restore the "deleted" tab.
	function handleDeletePage(pageId: string) {
		const isActivePage = get(editorStoreSvelte).activePageId === pageId;

		// Remove from store (switches activePageId if needed, clears dirty marker).
		deletePage(pageId);

		if (isActivePage) {
			// Canvas is showing the deleted page's content — swap it out for the
			// newly-active page without saving (we're discarding the deleted page).
			hydrateCanvasFromStore();
		}

		// Write the updated store state (without the deleted page) to localStorage
		// so a page refresh doesn't bring the tab back.
		saveFullStateToStorage();

		handlePaneClick();
	}

	// Duplicates a page: persist the current canvas first so a copy of the
	// active page reflects unsaved edits, clone + activate the copy in the
	// store, hydrate it onto the canvas, then persist the new page list.
	function handleDuplicatePage(pageId: string) {
		persistCanvasToStore();
		duplicatePage(pageId);
		hydrateCanvasFromStore();
		saveFullStateToStorage();
		handlePaneClick();
	}

	// Wipes every page back to one blank page. Nothing to persist first (we're
	// discarding), so just reset the store, hydrate the fresh page, and save.
	function handleDeleteAllPages() {
		deleteAllPages();
		hydrateCanvasFromStore();
		saveFullStateToStorage();
		handlePaneClick();
	}

	// Footer "shapes" counter — real diagram nodes only (connection anchors are
	// an internal edge-endpoint host, not a user shape).
	const shapeCount = $derived(nodes.filter((node) => node.type !== ANCHOR_NODE_TYPE).length);

	// =========================================================================
	// Editor action handlers (consumed by MenuBar / ToolBar via context).
	// =========================================================================

	async function performSave(generation: number, metaSignature: string) {
		persistCanvasToStore();
		saveActivePageToStorage();

		try {
			const data = JSON.parse(exportEditorStateAsJSON());
			const response = await fetch(`${API_URL}/diagrams/${page.params.id}`, {
				method: 'PATCH',
				credentials: 'include',
				headers: { 'Content-type': 'application/json' },
				body: JSON.stringify({
					data,
					title: editorMetaData.fileName,
					status: editorMetaData.status
				})
			});
			if (!response.ok) throw new Error(`Save failed with status ${response.status}`);

			// A newer edit/save may have started while this request was in flight.
			// Only the newest request is allowed to mark the document as saved.
			if (generation === saveGeneration) {
				savedMetaSignature = metaSignature;
				editorMetaData.lastSaved = Date.now();
				editorActionsState.saveStatus = 'saved';
			}
		} catch (e) {
			console.error('Save failed', e);
			if (generation === saveGeneration) {
				editorActionsState.saveStatus = 'error';
			}
		}
	}

	async function handleSave() {
		// A manual save supersedes a pending debounced autosave.
		if (autosaveTimer) clearTimeout(autosaveTimer);
		autosaveTimer = undefined;

		const generation = ++saveGeneration;
		editorActionsState.saveStatus = 'saving';
		await performSave(generation, createMetaSignature());
	}

	function handleNewFile() {
		const unsavedIds = get(visibleUnsavedPageIdsStore);
		if (unsavedIds.length > 0) {
			const ok = confirm('You have unsaved changes. Discard them and start a new file?');
			if (!ok) return;
		}
		resetEditorState();
		hydrateCanvasFromStore();
	}

	function handleOpenFile() {
		fileInput?.click();
	}

	function handleFileSelected(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // reset so re-selecting the same file still triggers change
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result;
			if (typeof content !== 'string') return;
			const ok = loadEditorStateFromJSON(content);
			if (!ok) {
				alert('Failed to open: file is not a valid EasyDraw diagram.');
				return;
			}
			hydrateCanvasFromStore();
		};
		reader.readAsText(file);
	}

	// Lazily resolved at call time so capture sees the current canvas DOM.
	let canvasShellEl: HTMLElement | undefined = $state();

	function getExportContext() {
		persistCanvasToStore();
		return {
			fileName: editorMetaData.fileName || 'easydraw',
			serializedState: exportEditorStateAsJSON(),
			canvasElement: canvasShellEl ?? null
		};
	}

	// Save As = "download a copy of the diagram as a native .easydraw file"
	// (draw.io's Save As semantics). Save (above) writes to localStorage.
	async function handleSaveAs() {
		const easydraw = getExporter('easydraw');
		if (!easydraw) return;
		await easydraw.run(getExportContext());
	}

	async function handleExport(formatId: string) {
		const exporter = getExporter(formatId);
		if (!exporter) {
			alert(`Unknown export format: ${formatId}`);
			return;
		}
		try {
			await exporter.run(getExportContext());
		} catch (err) {
			console.error(`Export to ${exporter.label} failed:`, err);
			alert(`Export to ${exporter.label} failed. See console for details.`);
		}
	}

	function applyHistorySnapshot(snapshot: string) {
		try {
			const parsed = JSON.parse(snapshot) as { nodes: Node[]; edges: Edge[] };
			isApplyingHistory = true;
			isHydratingCanvas = true;
			nodes = cloneNodes(parsed.nodes);
			edges = cloneGraph(parsed.edges);
			queueMicrotask(() => {
				isApplyingHistory = false;
				isHydratingCanvas = false;
			});
		} catch {
			// Ignore corrupt snapshot.
		}
	}

	function handleUndo() {
		const snapshot = historyUndo();
		if (snapshot) applyHistorySnapshot(snapshot);
	}

	function handleRedo() {
		const snapshot = historyRedo();
		if (snapshot) applyHistorySnapshot(snapshot);
	}

	// 15% step per click. We go through getZoom/setZoom rather than the
	// hook's zoomIn/zoomOut (which xyflow returns as direct property captures
	// — those silently no-op before panZoom mounts). setZoom is a lazy
	// wrapper so it always resolves to the live store function.
	const ZOOM_STEP = 1.15;

	function handleZoomIn() {
		flow.setZoom(flow.getZoom() * ZOOM_STEP);
	}
	function handleZoomOut() {
		flow.setZoom(flow.getZoom() / ZOOM_STEP);
	}
	function handleFitView() {
		flow.fitView();
	}

	function createNodeEditHandler(nodeId: string) {
		return (newData: any) => updateNodeData(nodeId, newData);
	}

	function handleDuplicate() {
		const nextNodes = duplicateSelectedNodes(nodes, createNodeEditHandler);
		if (nextNodes !== nodes) nodes = nextNodes;
	}

	function handleDeleteSelected() {
		const next = deleteSelectedGraph(nodes, edges);
		if (!next.changed) return;
		nodes = next.nodes;
		edges = next.edges;
	}

	function handleSelectAll() {
		const next = selectAllGraph(nodes, edges);
		nodes = next.nodes;
		edges = next.edges;
	}
	async function handleShare() {
		persistCanvasToStore();
		const json = exportEditorStateAsJSON();
		try {
			await navigator.clipboard.writeText(json);
			alert('Diagram JSON copied to clipboard. Paste it into a file to share.');
		} catch {
			// Clipboard blocked: fall back to a download.
			handleSaveAs();
		}
	}

	// =========================================================================
	// Copy / Paste - uses an in-memory snapshot keyed by selection.
	// =========================================================================
	function handleCopy() {
		const snapshot = copySelection(nodes, edges);
		if (!snapshot) return;
		clipboardSnapshot = snapshot;
		pasteCount = 0;
	}

	function handleCut() {
		const hasSelection = nodes.some((n) => n.selected) || edges.some((e) => e.selected);
		if (!hasSelection) return;
		handleCopy();
		handleDeleteSelected();
	}

	function handlePaste() {
		if (!clipboardSnapshot) return;
		pasteCount += 1;
		const next = pasteSnapshot(
			nodes,
			edges,
			clipboardSnapshot,
			pasteCount,
			createNodeEditHandler
		);
		nodes = next.nodes;
		edges = next.edges;
	}
	// =========================================================================
	// Graph actions - array order controls stacking in SvelteFlow.
	// =========================================================================
	function handleBringToFront() {
		const nextNodes = bringSelectedToFront(nodes);
		if (nextNodes !== nodes) nodes = nextNodes;
	}

	function handleSendToBack() {
		const nextNodes = sendSelectedToBack(nodes);
		if (nextNodes !== nodes) nodes = nextNodes;
	}

	function handleBringForward() {
		const nextNodes = bringSelectedForward(nodes);
		if (nextNodes !== nodes) nodes = nextNodes;
	}

	function handleSendBackward() {
		const nextNodes = sendSelectedBackward(nodes);
		if (nextNodes !== nodes) nodes = nextNodes;
	}

	function handleToggleNodeLock(id: string) {
		nodes = toggleNodeLock(nodes, id);
	}

	function handleGroup() {
		const next = groupSelectedNodes(nodes);
		if (!next.grouped) {
			alert('Select at least 2 nodes to group.');
			return;
		}
		nodes = next.nodes;
	}

	function handleUngroup() {
		const next = ungroupSelectedNodes(nodes);
		if (!next.ungrouped) {
			alert('Select a group node to ungroup.');
			return;
		}
		nodes = next.nodes;
	}
	// =========================================================================
	// View toggles + Export.
	// =========================================================================
	function handleToggleShowGrid() {
		editorActionsState.showGrid = !editorActionsState.showGrid;
	}

	function handleToggleSnapToGrid() {
		editorActionsState.snapToGrid = !editorActionsState.snapToGrid;
	}

	// Sets absolute zoom (1.0 = 100%) while preserving the current pan.
	function handleSetZoom(percent: number) {
		const { x, y } = flow.getViewport();
		flow.setViewport({ x, y, zoom: percent / 100 });
	}

	// Fits the viewport to selected nodes, or to all nodes if none selected.
	function handleFitSelection() {
		const selected = nodes.filter((n) => n.selected);
		if (selected.length === 0) {
			flow.fitView();
			return;
		}
		flow.fitView({ nodes: selected.map((n) => ({ id: n.id })) });
	}

	// Locks/unlocks node interaction (drag + connect). Pan + zoom stay available.
	function handleToggleLock() {
		editorActionsState.locked = !editorActionsState.locked;
	}

	function handleToggleStylePanel() {
		editorActionsState.showStylePanel = !editorActionsState.showStylePanel;
	}

	// ─── Present mode ───────────────────────────────────────────────────
	const presentPageIndex = $derived(
		Math.max(
			0,
			$editorStoreSvelte.pages.findIndex(
				(page) => page.id === $editorStoreSvelte.activePageId
			)
		)
	);

	let presentFitFrame: number | null = null;

	// Wait two paint frames: one for Svelte to render the hydrated page and one
	// for xyflow to measure its nodes. Replacing a pending frame prevents rapid
	// page clicks from fitting an older page after a newer one is already shown.
	function schedulePresentFit() {
		if (presentFitFrame !== null) cancelAnimationFrame(presentFitFrame);
		presentFitFrame = requestAnimationFrame(() => {
			presentFitFrame = requestAnimationFrame(() => {
				presentFitFrame = null;
				handleFitView();
			});
		});
	}

	// Reuse the normal switch pipeline so the page being left is synced before
	// the next one is hydrated. Every page is fitted independently because its
	// graph can occupy a different area of the canvas.
	function navigateToPresentPage(index: number) {
		const state = get(editorStoreSvelte);
		const targetPage = state.pages[index];
		if (!targetPage || targetPage.id === state.activePageId) return;

		handleSwitchPage(targetPage.id);
		schedulePresentFit();
	}

	function navigatePresentPage(direction: -1 | 1) {
		const state = get(editorStoreSvelte);
		const currentIndex = state.pages.findIndex((page) => page.id === state.activePageId);
		if (currentIndex < 0) return;

		navigateToPresentPage(currentIndex + direction);
	}

	// Enter a clean, read-only fullscreen-ish view of the current page.
	function handlePresent() {
		// Clear selection so no red ring / style panel lingers over the canvas.
		nodes = nodes.map((n) => ({ ...n, selected: false }));
		edges = edges.map((e) => ({ ...e, selected: false }));
		editorActionsState.presenting = true;
		// Re-fit after the chrome is hidden (the canvas grows to fill the screen).
		schedulePresentFit();
	}

	function handleExitPresent() {
		if (presentFitFrame !== null) cancelAnimationFrame(presentFitFrame);
		presentFitFrame = null;
		editorActionsState.presenting = false;
	}

	// Present top-bar auto-hide: the bar floats over the canvas and slides up
	// after 2s unless the cursor is near the top edge (Lucidchart-style).
	let presentBarVisible = $state(true);
	const PRESENT_BAR_ZONE = 64; // px from the top that keeps/reveals the bar

	$effect(() => {
		if (!editorActionsState.presenting) return;

		presentBarVisible = true;
		let hideTimer: ReturnType<typeof setTimeout> | null = null;

		const cancelHide = () => {
			if (hideTimer) clearTimeout(hideTimer);
			hideTimer = null;
		};
		const startHide = () => {
			if (hideTimer) return; // already counting down since leaving the top
			hideTimer = setTimeout(() => {
				presentBarVisible = false;
				hideTimer = null;
			}, 2000);
		};

		const onMove = (e: MouseEvent) => {
			if (e.clientY <= PRESENT_BAR_ZONE) {
				presentBarVisible = true; // cursor at top → reveal + keep open
				cancelHide();
			} else {
				startHide(); // cursor left the top → retract after 2s
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				handleExitPresent();
				return;
			}

			if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

			if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
				e.preventDefault();
				navigatePresentPage(-1);
			} else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
				e.preventDefault();
				navigatePresentPage(1);
			} else if (e.key === 'Home') {
				e.preventDefault();
				navigateToPresentPage(0);
			} else if (e.key === 'End') {
				e.preventDefault();
				navigateToPresentPage(get(editorStoreSvelte).pages.length - 1);
			}
		};

		window.addEventListener('mousemove', onMove);
		window.addEventListener('keydown', onKey);
		startHide(); // auto-hide 2s after entering if the cursor isn't at the top

		return () => {
			cancelHide();
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('keydown', onKey);
		};
	});

	// Live viewport transform — drives the toolbar zoom % AND the canvas
	// scrollbars (they need x/y to know which world region is visible).
	let canvasViewport = $state({ x: 0, y: 0, zoom: 1 });

	function handleViewportMove(_event: any, viewport: { x: number; y: number; zoom: number }) {
		editorActionsState.zoomPercent = Math.round(viewport.zoom * 100);
		canvasViewport = viewport;
	}

	// Single context object exposed to MenuBar and ToolBar as 'editor'.
	setContext('editor', {
		state: editorActionsState,
		history: historyState,
		save: handleSave,
		present: handlePresent,
		newFile: handleNewFile,
		open: handleOpenFile,
		saveAs: handleSaveAs,
		exportFormats: EXPORTERS,
		exportAs: handleExport,
		undo: handleUndo,
		redo: handleRedo,
		cut: handleCut,
		copy: handleCopy,
		paste: handlePaste,
		zoomIn: handleZoomIn,
		zoomOut: handleZoomOut,
		fitView: handleFitView,
		duplicate: handleDuplicate,
		deleteSelected: handleDeleteSelected,
		selectAll: handleSelectAll,
		share: handleShare,
		bringToFront: handleBringToFront,
		sendToBack: handleSendToBack,
		bringForward: handleBringForward,
		sendBackward: handleSendBackward,
		toggleNodeLock: handleToggleNodeLock,
		group: handleGroup,
		ungroup: handleUngroup,
		toggleShowGrid: handleToggleShowGrid,
		toggleSnapToGrid: handleToggleSnapToGrid,
		setZoom: handleSetZoom,
		fitSelection: handleFitSelection,
		toggleLock: handleToggleLock,
		toggleStylePanel: handleToggleStylePanel,
		// Text style of the current selection (or null) + a patcher — drives the
		// ToolBar's font / size / B / I / U / colour controls. A getter so reads
		// stay reactive to the current selection. A selected NODE wins; otherwise
		// a selected EDGE exposes its label text style (different defaults so the
		// controls read the connection-label look).
		get nodeStyle() {
			if (selectedNode) {
				const d = (selectedNode.data ?? {}) as Record<string, unknown>;
				return {
					fontFamily: (d.fontFamily as string) ?? 'Inter',
					fontSize: (d.fontSize as number) ?? 14,
					bold: !!d.bold,
					italic: !!d.italic,
					underline: !!d.underline,
					textColor: (d.textColor as string) ?? '#2c2c2a'
				};
			}
			if (selectedEdge) {
				const d = (selectedEdge.data ?? {}) as Record<string, unknown>;
				return {
					fontFamily: (d.fontFamily as string) ?? 'Inter',
					fontSize: (d.fontSize as number) ?? 13,
					bold: !!d.bold,
					italic: !!d.italic,
					underline: !!d.underline,
					textColor: (d.textColor as string) ?? '#1f1d1a'
				};
			}
			// Nothing selected → expose the editable default so the toolbar font /
			// size / etc. controls stay live and set the default for new nodes.
			return {
				fontFamily: defaultTextStyle.fontFamily,
				fontSize: defaultTextStyle.fontSize,
				bold: defaultTextStyle.bold,
				italic: defaultTextStyle.italic,
				underline: defaultTextStyle.underline,
				textColor: defaultTextStyle.textColor
			};
		},
		applyStyle: handleStyleChange
	});

	// Centralized orphan-anchor cleanup. A connection anchor only ever exists
	// to host a floating edge endpoint, so any anchor not referenced by some
	// edge's source/target is garbage — left behind when its edge was deleted,
	// when a node delete cascaded its edges away, or when an endpoint was
	// reconnected off the anchor. Running this reactively (instead of sprinkling
	// prune calls across every delete path, including ContextMenu's direct
	// deleteElements) covers ALL of them uniformly. It self-converges: removing
	// the orphans re-runs the effect once more, finds none, and stops.
	$effect(() => {
		edges;
		nodes;
		if (isHydratingCanvas) return;

		const referenced = new Set<string>();
		for (const e of edges) {
			referenced.add(e.source);
			referenced.add(e.target);
		}
		const hasOrphan = nodes.some((n) => n.type === ANCHOR_NODE_TYPE && !referenced.has(n.id));
		if (hasOrphan) {
			nodes = nodes.filter((n) => !(n.type === ANCHOR_NODE_TYPE && !referenced.has(n.id)));
		}
	});

	// Marks active page as dirty immediately when canvas diverges from last synced state,
	// and records a debounced history snapshot for undo/redo.
	$effect(() => {
		nodes;
		edges;

		if (!canvasPageId || isHydratingCanvas) return;

		const currentCanvasSignature = createCanvasSignature(nodes, edges);

		if (currentCanvasSignature !== baselineCanvasSignature) {
			markCanvasDirtyPage(canvasPageId);
		} else {
			clearCanvasDirtyPage(canvasPageId);
		}

		// Skip recording while undo/redo is restoring a snapshot.
		if (!isApplyingHistory) {
			if (historyDebounceTimer) clearTimeout(historyDebounceTimer);
			historyDebounceTimer = setTimeout(() => {
				recordSnapshot(currentCanvasSignature);
			}, 350);
		}
	});

	// Autosave: canvas and document metadata are deliberately tracked by
	// separate effects. A title/status edit must save even when nodes/edges are
	// untouched; both paths share one debounce timer so simultaneous edits still
	// produce a single request.
	function createMetaSignature() {
		return `${editorMetaData.fileName}\u0000${editorMetaData.status}`;
	}

	function scheduleAutosave(metaSignature: string) {
		if (autosaveTimer) clearTimeout(autosaveTimer);
		const generation = ++saveGeneration;
		editorActionsState.saveStatus = 'saving';
		autosaveTimer = setTimeout(() => {
			autosaveTimer = undefined;
			void performSave(generation, metaSignature);
		}, 1000);
	}

	// Metadata-only autosave: these two property reads are the reactive
	// dependencies, independent of any canvas mutation.
	$effect(() => {
		const metaSignature = createMetaSignature();

		if (isHydratingCanvas || !canvasPageId) return;
		if (savedMetaSignature === null) {
			savedMetaSignature = metaSignature;
			return;
		}
		if (metaSignature === savedMetaSignature) return;

		scheduleAutosave(metaSignature);
	});

	// Canvas autosave retains the existing signature/baseline behaviour.
	$effect(() => {
		const canvasSignature = createCanvasSignature(nodes, edges);

		if (isHydratingCanvas || !canvasPageId) return;
		if (canvasSignature === baselineCanvasSignature) return;

		scheduleAutosave(createMetaSignature());
	});

	// Loads editor store from localStorage once and hydrates canvas from it.
	onMount(() => {
		hydrateCanvasFromStore();

		// Prevent navigation if unsaved changes
		beforeNavigate(({ cancel }) => {
			const unsavedIds = get(visibleUnsavedPageIdsStore);
			if (unsavedIds.length > 0) {
				const confirmed = confirm(
					'You have unsaved changes. Are you sure you want to leave?'
				);
				if (!confirmed) {
					cancel(); // Stops the navigation
				}
			}
		});

		// Centralized shortcut router. Reuses the same handlers wired into the
		// MenuBar / ToolBar so behavior stays in lockstep with the UI.
		const handleKeyboard = createEditorKeyboardHandler({
			save: handleSave,
			saveAs: handleSaveAs,
			undo: handleUndo,
			redo: handleRedo,
			duplicate: handleDuplicate,
			selectAll: handleSelectAll,
			copy: handleCopy,
			cut: handleCut,
			paste: handlePaste,
			deleteSelected: handleDeleteSelected,
			bringToFront: handleBringToFront,
			sendToBack: handleSendToBack,
			group: handleGroup,
			ungroup: handleUngroup,
			fitView: handleFitView,
			zoomIn: handleZoomIn,
			zoomOut: handleZoomOut,
			toggleTextStyle,
			hasSelection: () => nodes.some((n) => n.selected) || edges.some((e) => e.selected),
			hasStyleSelection: () => !!selectedNode || !!selectedEdge
		});
		const handleEditorKeyboard = (event: KeyboardEvent) => {
			// Present mode is read-only and owns its own navigation shortcuts.
			if (editorActionsState.presenting) return;
			handleKeyboard(event);
		};
		window.addEventListener('keydown', handleEditorKeyboard);
		return () => {
			window.removeEventListener('keydown', handleEditorKeyboard);
		};
	});

	// Any selected node — drives the StylePanel.
	let selectedNode = $derived(nodes.find((n) => n.selected));

	// Any selected edge — lets the toolbar text controls style connection labels
	// when no node is selected.
	let selectedEdge = $derived(edges.find((e) => e.selected));

	// Style edits land on node.data (or edge.data) so they ride existing
	// persistence + history. A selected node takes priority; otherwise the patch
	// applies to a selected edge's label style.
	function handleStyleChange(patch: NodeStyleData) {
		if (selectedNode) {
			updateNodeData(selectedNode.id, patch);
			return;
		}
		if (selectedEdge) {
			updateEdgeData(selectedEdge.id, patch);
			return;
		}
		// Nothing selected → update the default text style for future nodes. Only
		// the text fields are relevant here (the toolbar is the only source).
		if (patch.fontFamily !== undefined) defaultTextStyle.fontFamily = patch.fontFamily;
		if (patch.fontSize !== undefined) defaultTextStyle.fontSize = patch.fontSize;
		if (patch.bold !== undefined) defaultTextStyle.bold = patch.bold;
		if (patch.italic !== undefined) defaultTextStyle.italic = patch.italic;
		if (patch.underline !== undefined) defaultTextStyle.underline = patch.underline;
		if (patch.textColor !== undefined) defaultTextStyle.textColor = patch.textColor;
	}

	// Flip a boolean text-style field (bold / italic / underline) on the current
	// selection — the Ctrl+B / Ctrl+I / Ctrl+U shortcuts. Reads the current value
	// off the selected node/edge data so the toggle mirrors the toolbar buttons.
	function toggleTextStyle(field: 'bold' | 'italic' | 'underline') {
		const data = (selectedNode?.data ?? selectedEdge?.data) as
			| Record<string, unknown>
			| undefined;
		if (!data) return;
		const next = !data[field];
		if (field === 'bold') handleStyleChange({ bold: next });
		else if (field === 'italic') handleStyleChange({ italic: next });
		else handleStyleChange({ underline: next });
	}

	// Position edits replace node.position; xyflow re-renders from the new value.
	function handlePositionChange(x: number, y: number) {
		if (!selectedNode) return;
		const targetId = selectedNode.id;
		nodes = nodes.map((n) => (n.id === targetId ? { ...n, position: { x, y } } : n));
	}

	// Size edits set width/height + an inline style override so resized nodes
	// stay sized after re-render (matches how NodeResizer persists size).
	function handleSizeChange(width: number, height: number) {
		if (!selectedNode) return;
		const targetId = selectedNode.id;
		nodes = nodes.map((n) =>
			n.id === targetId
				? {
						...n,
						width,
						height,
						style: `width: ${width}px; height: ${height}px;`
					}
				: n
		);
	}

	// Function to update the data of a specific node
	function updateNodeData(nodeId: string, newData: any) {
		// Since you use $state.raw, we must trigger a full reassignment
		nodes = nodes.map((n) => {
			if (n.id === nodeId) {
				// Merge existing data with the new data from RightSidebar
				return {
					...n,
					data: { ...n.data, ...newData }
				};
			}
			return n;
		});
	}

	// Merge a data patch into a specific edge (e.g. label text style). Mirrors
	// updateNodeData — edges is $state.raw, so reassign the whole array.
	function updateEdgeData(edgeId: string, newData: any) {
		edges = edges.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, ...newData } } : e));
	}

	// New connections use the orthogonal `connection` edge by default.
	// bendPoints starts empty — the routing layer L-shapes the initial path
	// from the source/target handle positions, and the user adds bends by
	// dragging ghost pills. Fires only on a VALID handle→handle drop.
	function onConnect(connection: Connection) {
		const newEdge: Edge = {
			...connection,
			id: nanoid(),
			type: 'connection',
			data: { bendPoints: [] }
		};
		edges = addEdge(newEdge, edges);
	}

	// Builds a `connection` edge between a real node handle and an anchor,
	// honouring which side the user dragged FROM so direction stays correct
	// under ConnectionMode.Loose. `type` is xyflow's HandleType ('source' |
	// 'target') — spelled inline to avoid importing the alias.
	function makeAnchoredEdge(
		fromHandle: { nodeId: string; id?: string | null; type: 'source' | 'target' },
		anchorId: string
	): Edge {
		const base = {
			id: nanoid(),
			type: 'connection',
			data: { bendPoints: [] }
		};
		// fromHandle is the end the user started dragging. The floating anchor
		// takes the opposite role.
		if (fromHandle.type === 'target') {
			return {
				...base,
				source: anchorId,
				sourceHandle: ANCHOR_HANDLE_ID,
				target: fromHandle.nodeId,
				targetHandle: fromHandle.id ?? null
			} as Edge;
		}
		return {
			...base,
			source: fromHandle.nodeId,
			sourceHandle: fromHandle.id ?? null,
			target: anchorId,
			targetHandle: ANCHOR_HANDLE_ID
		} as Edge;
	}

	// Drop position in flow coords from the native connect/​reconnect end event.
	function dropFlowPosition(event: MouseEvent | TouchEvent) {
		const pt = 'changedTouches' in event ? event.changedTouches[0] : event;
		return flow.screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
	}

	// Req #1 / #2 — when a freshly dragged connection is released over EMPTY
	// canvas (no valid handle under the pointer), xyflow fires no `onconnect`,
	// so without this the edge would simply vanish. Instead we drop a floating
	// anchor at the release point and keep the edge, with that end attached to
	// the anchor. We only act when there's no target handle, so this never
	// double-creates alongside `onConnect`. (Endpoint RECONNECTION is handled
	// entirely inside ConnectionEdge's manual drag — it never goes through
	// xyflow's connection machinery, so it doesn't reach here.)
	const onConnectEnd: OnConnectEnd = (event, connectionState) => {
		if (connectionState.toHandle) return; // landed on a real handle → onConnect handled it
		const fromHandle = connectionState.fromHandle;
		if (!fromHandle) return;

		const anchorId = nanoid();
		const anchor = createAnchorNode(anchorId, dropFlowPosition(event));
		const newEdge = makeAnchoredEdge(
			{ nodeId: fromHandle.nodeId, id: fromHandle.id, type: fromHandle.type },
			anchorId
		);

		// Add the anchor and the edge in the same tick so the prune effect
		// (below) always sees the anchor as referenced and never collects it.
		nodes = [...nodes, anchor];
		edges = [...edges, newEdge];
	};
</script>

<main class="flex h-screen flex-col">
	{#if editorActionsState.presenting}
		<!-- Present mode: a minimal top bar floating over the canvas. It's `fixed`
		     (out of flow) so the canvas fills the whole screen, and slides up when
		     `presentBarVisible` is false (2s after the cursor leaves the top). -->
		<header
			class="fixed inset-x-0 top-0 z-50 grid h-[52px]
				grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-line-soft
				bg-white px-4 shadow-sm transition-transform duration-300 ease-out
				{presentBarVisible ? 'translate-y-0' : '-translate-y-full'}"
		>
			<button
				type="button"
				class="inline-flex cursor-pointer items-center gap-2 justify-self-start rounded-md border-none bg-transparent
					px-2 py-1.5 text-[0.95rem] text-ink-soft hover:bg-surface-hover"
				onclick={handleExitPresent}
			>
				<svg
					viewBox="0 0 24 24"
					class="h-5 w-5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="15 18 9 12 15 6" />
				</svg>
				Back
				<span class="hidden text-[0.8rem] text-ink-muted sm:inline">ESC</span>
			</button>

			<span
				class="max-w-[40vw] truncate px-4 text-center text-[0.95rem] font-medium text-ink"
			>
				{editorMetaData.fileName || 'Untitled'}
			</span>

			<div class="min-w-0 justify-self-end">
				<div
					class="inline-flex h-8 max-w-[240px] items-center overflow-hidden rounded-lg border
							border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
					role="group"
					aria-label="Presentation page navigation"
				>
					<button
						type="button"
						class="inline-flex h-full w-8 flex-shrink-0 cursor-pointer items-center justify-center
								border-none bg-transparent text-ink-soft transition-colors hover:bg-surface-hover
								disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
						aria-label="Previous page"
						title="Previous page (Left arrow)"
						disabled={presentPageIndex === 0}
						onclick={() => navigatePresentPage(-1)}
					>
						<svg
							viewBox="0 0 24 24"
							class="h-4 w-4"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<polyline points="15 18 9 12 15 6" />
						</svg>
					</button>

					<div
						class="flex min-w-0 items-center justify-center gap-2 border-x border-line-soft px-2.5"
						aria-live="polite"
					>
						<span
							class="hidden max-w-[116px] truncate text-[0.8rem] font-medium text-ink md:block"
							title={$editorStoreSvelte.pages[presentPageIndex]?.name ?? 'Page'}
						>
							{$editorStoreSvelte.pages[presentPageIndex]?.name ?? 'Page'}
						</span>
						<span class="whitespace-nowrap text-[0.72rem] tabular-nums text-ink-muted">
							{presentPageIndex + 1} / {$editorStoreSvelte.pages.length}
						</span>
					</div>

					<button
						type="button"
						class="inline-flex h-full w-8 flex-shrink-0 cursor-pointer items-center justify-center
								border-none bg-transparent text-ink-soft transition-colors hover:bg-surface-hover
								disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
						aria-label="Next page"
						title="Next page (Right arrow)"
						disabled={presentPageIndex === $editorStoreSvelte.pages.length - 1}
						onclick={() => navigatePresentPage(1)}
					>
						<svg
							viewBox="0 0 24 24"
							class="h-4 w-4"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>
				</div>
			</div>
		</header>
	{:else}
		<MenuBar />
		<ToolBar />
	{/if}
	<input
		type="file"
		accept=".easydraw,.json,application/xml,application/json"
		bind:this={fileInput}
		onchange={handleFileSelected}
		hidden
	/>
	<section
		class="canvas-shell relative min-h-0 flex-auto"
		class:locked={editorActionsState.locked}
		bind:clientWidth
		bind:clientHeight
		bind:this={canvasShellEl}
	>
		<SvelteFlow
			bind:nodes
			bind:edges
			{defaultEdgeOptions}
			fitView
			fitViewOptions={{ maxZoom: 1 }}
			ondragover={onDragOver}
			ondrop={onDrop}
			onnodecontextmenu={handleContextMenu}
			onpaneclick={handlePaneClick}
			onpointerdown={handlePaneClick}
			onconnect={onConnect}
			onconnectend={onConnectEnd}
			onmove={handleViewportMove}
			snapGrid={editorActionsState.snapToGrid ? [20, 20] : undefined}
			nodesDraggable={!editorActionsState.locked && !editorActionsState.presenting}
			nodesConnectable={!editorActionsState.locked && !editorActionsState.presenting}
			elementsSelectable={!editorActionsState.locked && !editorActionsState.presenting}
			{nodeTypes}
			{edgeTypes}
			connectionMode={ConnectionMode.Loose}
			connectionLineComponent={ConnectionLinePreview}
			proOptions={{ hideAttribution: true }}
		>
			{#if editorActionsState.showGrid}
				<Background variant={BackgroundVariant.Dots} />
			{/if}
			{#if menu}
				<ContextMenu
					onclick={handlePaneClick}
					id={menu.id}
					top={menu.top}
					left={menu.left}
					right={menu.right}
					bottom={menu.bottom}
				/>
			{/if}
		</SvelteFlow>

		<!-- Draw.io-style scrollbars: only visible when a node is out of view
		     on that axis; dragging a thumb pans the viewport to reach it. -->
		<CanvasScrollbars
			{nodes}
			viewport={canvasViewport}
			width={clientWidth}
			height={clientHeight}
		/>

		{#if !editorActionsState.presenting}
			<Sidebar />

			{#if editorActionsState.showStylePanel}
				{#if selectedNode}
					{@const activeNode = selectedNode}
					<StylePanel
						node={activeNode}
						onStyleChange={handleStyleChange}
						onPositionChange={handlePositionChange}
						onSizeChange={handleSizeChange}
						onBringToFront={handleBringToFront}
						onSendToBack={handleSendToBack}
						onDuplicate={handleDuplicate}
						onDelete={handleDeleteSelected}
					/>
				{:else if selectedEdge}
					{@const activeEdge = selectedEdge}
					<ConnectionStylePanel
						edge={activeEdge}
						onDataChange={(patch) => updateEdgeData(activeEdge.id, patch)}
						onDelete={handleDeleteSelected}
					/>
				{/if}
			{/if}
		{/if}
	</section>

	{#if !editorActionsState.presenting}
		<EditorFooter
			nodeCount={shapeCount}
			onSwitchPage={handleSwitchPage}
			onCreatePage={handleCreatePage}
			onDeletePage={handleDeletePage}
			onDuplicatePage={handleDuplicatePage}
			onDeleteAllPages={handleDeleteAllPages}
		/>
	{/if}
</main>

<style>
	/*
	 * The layout classes (main = flex h-screen flex-col, canvas-shell = relative
	 * min-h-0 flex-auto) now live inline as Tailwind utilities. The rules below
	 * stay in CSS because they reach into xyflow's own DOM via :global — there's
	 * no element in this template to hang a utility class on. `.canvas-shell` and
	 * `.locked` are kept purely as :global hooks for these selectors.
	 */

	/*
	 * Lock mode: disable every interaction inside the canvas (clicks, drags,
	 * focusing inputs, dragging handles). Pan + zoom still work on the empty
	 * pane background. Toolbar / menu / sidebar are outside .canvas-shell, so
	 * they stay live — matching the requirement that only those still work.
	 */
	.canvas-shell.locked :global(.svelte-flow__node),
	.canvas-shell.locked :global(.svelte-flow__handle),
	.canvas-shell.locked :global(.svelte-flow__edge) {
		pointer-events: none;
		user-select: none;
	}

	/* Keep SvelteFlow sized to the available canvas shell area. */
	.canvas-shell :global(.svelte-flow) {
		width: 100%;
		height: 100%;
	}
</style>
