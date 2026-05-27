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
		type NodeEventWithPointer, ConnectionMode,
		type Connection
	} from '@xyflow/svelte';
	import { get } from 'svelte/store';

	import { useDnD } from '$lib/flow/DnDProvider.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';

	import StylePanel, { type NodeStyleData } from '$lib/components/StylePanel.svelte';
	import { EXPORTERS, getExporter } from '$lib/exporters';
	import RelationshipEdge from '$lib/flow/edges/RelationshipEdge.svelte';
	import ConnectionEdge from '$lib/flow/edges/connection/ConnectionEdge.svelte';
	import CrowsFootMarkers from './edges/CrowsFootMarkers.svelte';
	import { buildNodeTypesMap, getShape } from '$lib/flow/nodes/registry';

	import EditorFooter from '$lib/components/EditorFooter.svelte';
	import MenuBar from '$lib/components/menubar/MenuBar.svelte';
	import ToolBar from '$lib/components/toolbar/ToolBar.svelte';
	import ContextMenu from '$lib/flow/ContextMenu.svelte';
	import {
		clearCanvasDirtyPage,
		createPage,
		deletePage,
		editorMetaData,
		editorStoreSvelte,
		exportEditorStateAsJSON,
		loadEditorStateFromJSON,
		loadEditorStateFromStorage,
		markCanvasDirtyPage,
		resetEditorState,
		saveActivePageToStorage,
		saveFullStateToStorage,
		switchPage,
		updateActiveGraph,
		visibleUnsavedPageIdsStore,
	} from '$lib/stores/editor.store.svelte';
	import {
		historyState,
		recordSnapshot,
		resetHistory,
		undo as historyUndo,
		redo as historyRedo
	} from '$lib/stores/history.store.svelte';

	// import '@xyflow/svelte/dist/style.css';
	import '../../xy-theme.css';

	setContext('updateNode', (id: string, data: any) => updateNodeData(id, data));

	// nodeTypes map is built from the shape registry — adding a new node
	// type means adding it to src/lib/flow/nodes/registry.ts, not editing here.
	const nodeTypes = buildNodeTypesMap();

	// `connection` is the general-purpose orthogonal edge with rounded
	// corners and draggable bend pills. `relationship` is kept for the older
	// ER-diagram crow's-foot edges so saved diagrams still resolve.
	const edgeTypes = {
		connection: ConnectionEdge,
		relationship: RelationshipEdge
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

		const cloned = typeof structuredClone === 'function'
			? structuredClone(serializable)
			: (JSON.parse(JSON.stringify(serializable)) as Node[]);

		return cloned.map((n) => ({
			...n,
			data: {
					...n.data,
					onEdit: (newData: any) => updateNodeData(n.id, newData)
			}
		})) as Node[];
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
		locked: false
	});

	// In-memory clipboard for Copy / Paste. JSON-clean (no function refs).
	let clipboardSnapshot: { nodes: Node[]; edges: Edge[] } | null = null;

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

		const nodeData = shape.defaultData();
		const newNodeId = nanoid();

		const newNode = {
			id: newNodeId,
			type: type.current,
			position,
			data: {
				...nodeData,
				onEdit: (newData: any) => updateNodeData(newNodeId, newData)
			},
			origin: [0.5, 0.0]
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

	// =========================================================================
	// Editor action handlers (consumed by MenuBar / ToolBar via context).
	// =========================================================================

	function handleSave() {
		persistCanvasToStore();
		saveActivePageToStorage();
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

	function handleDuplicate() {
		const selected = nodes.filter((n) => n.selected);
		if (selected.length === 0) return;

		const copies = selected.map((n) => {
			const newId = nanoid();
			return {
				...n,
				id: newId,
				position: { x: n.position.x + 30, y: n.position.y + 30 },
				selected: false,
				data: {
					...n.data,
					onEdit: (newData: any) => updateNodeData(newId, newData)
				}
			};
		});

		nodes = [...nodes.map((n) => ({ ...n, selected: false })), ...copies];
	}

	function handleDeleteSelected() {
		const hasSelectedNodes = nodes.some((n) => n.selected);
		const hasSelectedEdges = edges.some((e) => e.selected);
		if (!hasSelectedNodes && !hasSelectedEdges) return;

		if (hasSelectedNodes) nodes = nodes.filter((n) => !n.selected);
		if (hasSelectedEdges) edges = edges.filter((e) => !e.selected);
	}

	function handleSelectAll() {
		nodes = nodes.map((n) => ({ ...n, selected: true }));
		edges = edges.map((e) => ({ ...e, selected: true }));
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
	// Copy / Paste — uses an in-memory snapshot keyed by selection.
	// =========================================================================
	function handleCopy() {
		const selectedNodes = nodes.filter((n) => n.selected);
		if (selectedNodes.length === 0) return;

		const selectedIds = new Set(selectedNodes.map((n) => n.id));
		const selectedEdges = edges.filter(
			(e) => selectedIds.has(e.source) && selectedIds.has(e.target)
		);

		// Strip onEdit so the clone is JSON-clean. cloneNodes re-attaches it on paste.
		clipboardSnapshot = {
			nodes: JSON.parse(JSON.stringify(selectedNodes)),
			edges: JSON.parse(JSON.stringify(selectedEdges))
		};
	}

	// Cut = copy the current selection to the in-memory clipboard, then remove
	// it from the canvas. Mirrors the same selection rules as Copy.
	function handleCut() {
		const hasSelection =
			nodes.some((n) => n.selected) || edges.some((e) => e.selected);
		if (!hasSelection) return;
		handleCopy();
		handleDeleteSelected();
	}

	function handlePaste() {
		if (!clipboardSnapshot) return;

		const idMap = new Map<string, string>();

		const pastedNodes = clipboardSnapshot.nodes.map((n) => {
			const newId = nanoid();
			idMap.set(n.id, newId);
			return {
				...n,
				id: newId,
				position: { x: n.position.x + 40, y: n.position.y + 40 },
				selected: true,
				data: {
					...n.data,
					onEdit: (newData: any) => updateNodeData(newId, newData)
				}
			} as Node;
		});

		const pastedEdges = clipboardSnapshot.edges.map((e) => ({
			...e,
			id: nanoid(),
			source: idMap.get(e.source) ?? e.source,
			target: idMap.get(e.target) ?? e.target,
			selected: true
		}));

		nodes = [...nodes.map((n) => ({ ...n, selected: false })), ...pastedNodes];
		edges = [...edges.map((e) => ({ ...e, selected: false })), ...pastedEdges];
	}

	// =========================================================================
	// Z-order — array order controls render stacking in SvelteFlow.
	// =========================================================================
	function handleBringToFront() {
		const selected = nodes.filter((n) => n.selected);
		if (selected.length === 0) return;
		const others = nodes.filter((n) => !n.selected);
		nodes = [...others, ...selected];
	}

	function handleSendToBack() {
		const selected = nodes.filter((n) => n.selected);
		if (selected.length === 0) return;
		const others = nodes.filter((n) => !n.selected);
		nodes = [...selected, ...others];
	}

	// =========================================================================
	// Group / Ungroup — wraps selected nodes in a parent container.
	// =========================================================================
	function handleGroup() {
		const selected = nodes.filter((n) => n.selected && !(n as any).parentId);
		if (selected.length < 2) {
			alert('Select at least 2 nodes to group.');
			return;
		}

		const PADDING = 24;
		const minX = Math.min(...selected.map((n) => n.position.x));
		const minY = Math.min(...selected.map((n) => n.position.y));
		const maxX = Math.max(
			...selected.map((n) => n.position.x + (((n as any).width ?? n.measured?.width) ?? 150))
		);
		const maxY = Math.max(
			...selected.map((n) => n.position.y + (((n as any).height ?? n.measured?.height) ?? 80))
		);

		const groupId = nanoid();
		const groupNode = {
			id: groupId,
			type: 'group',
			position: { x: minX - PADDING, y: minY - PADDING },
			data: {},
			style: `width: ${maxX - minX + PADDING * 2}px; height: ${maxY - minY + PADDING * 2}px;`
		} as unknown as Node;

		const selectedIds = new Set(selected.map((n) => n.id));
		const next: Node[] = [
			groupNode,
			...nodes.map((n) => {
				if (!selectedIds.has(n.id)) return n;
				return {
					...n,
					parentId: groupId,
					extent: 'parent' as const,
					position: {
						x: n.position.x - (minX - PADDING),
						y: n.position.y - (minY - PADDING)
					},
					selected: false
				};
			})
		];
		nodes = next;
	}

	function handleUngroup() {
		const selectedGroups = nodes.filter((n) => n.selected && n.type === 'group');
		if (selectedGroups.length === 0) {
			alert('Select a group node to ungroup.');
			return;
		}

		const groupIds = new Set(selectedGroups.map((g) => g.id));
		const groupById = new Map(selectedGroups.map((g) => [g.id, g]));

		nodes = nodes
			.filter((n) => !groupIds.has(n.id))
			.map((n) => {
				const parentId = (n as any).parentId as string | undefined;
				if (parentId && groupIds.has(parentId)) {
					const parent = groupById.get(parentId)!;
					const { parentId: _drop, extent: _drop2, ...rest } = n as any;
					return {
						...rest,
						position: {
							x: parent.position.x + n.position.x,
							y: parent.position.y + n.position.y
						}
					} as Node;
				}
				return n;
			});
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

	// SvelteFlow viewport changes drive the live zoom % shown in the toolbar.
	function handleViewportMove(_event: any, viewport: { zoom: number }) {
		editorActionsState.zoomPercent = Math.round(viewport.zoom * 100);
	}

	// Single context object exposed to MenuBar and ToolBar as 'editor'.
	setContext('editor', {
		state: editorActionsState,
		history: historyState,
		save: handleSave,
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
		group: handleGroup,
		ungroup: handleUngroup,
		toggleShowGrid: handleToggleShowGrid,
		toggleSnapToGrid: handleToggleSnapToGrid,
		setZoom: handleSetZoom,
		fitSelection: handleFitSelection,
		toggleLock: handleToggleLock
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

	// Loads editor store from localStorage once and hydrates canvas from it.
	onMount(() => {
		loadEditorStateFromStorage();
		hydrateCanvasFromStore();

		// Prevent navigation if unsaved changes
		beforeNavigate(({ cancel }) => {
			const unsavedIds = get(visibleUnsavedPageIdsStore);
			if (unsavedIds.length > 0) {
				const confirmed = confirm(
					"You have unsaved changes. Are you sure you want to leave?"
				);
				if (!confirmed) {
					cancel(); // Stops the navigation
				}
			}
		});

		// Centralized shortcut router. Reuses the same handlers wired into the
		// MenuBar / ToolBar so behavior stays in lockstep with the UI.
		const handleKeyboard = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement;
			const isInInput =
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable;

			const meta = event.ctrlKey || event.metaKey;
			const key = event.key.toLowerCase();

			if (meta && key === 's') {
				event.preventDefault();
				if (event.shiftKey) handleSaveAs();
				else handleSave();
				return;
			}

			if (meta && key === 'z') {
				if (isInInput) return;
				event.preventDefault();
				if (event.shiftKey) handleRedo();
				else handleUndo();
				return;
			}

			if (meta && key === 'y') {
				if (isInInput) return;
				event.preventDefault();
				handleRedo();
				return;
			}

			if (meta && key === 'd') {
				if (isInInput) return;
				event.preventDefault();
				handleDuplicate();
				return;
			}

			if (meta && key === 'a') {
				if (isInInput) return;
				event.preventDefault();
				handleSelectAll();
				return;
			}

			if (meta && key === 'c') {
				if (isInInput) return;
				event.preventDefault();
				handleCopy();
				return;
			}

			if (meta && key === 'x') {
				if (isInInput) return;
				event.preventDefault();
				handleCut();
				return;
			}

			if (meta && key === 'v') {
				if (isInInput) return;
				event.preventDefault();
				handlePaste();
				return;
			}

			if (meta && event.shiftKey && key === 'f') {
				event.preventDefault();
				handleBringToFront();
				return;
			}

			if (meta && event.shiftKey && key === 'b') {
				event.preventDefault();
				handleSendToBack();
				return;
			}

			if (meta && event.shiftKey && key === 'g') {
				if (isInInput) return;
				event.preventDefault();
				handleUngroup();
				return;
			}

			if (meta && key === 'g') {
				if (isInInput) return;
				event.preventDefault();
				handleGroup();
				return;
			}

			if (meta && event.shiftKey && key === 'h') {
				event.preventDefault();
				handleFitView();
				return;
			}

			if (meta && (key === '=' || key === '+')) {
				event.preventDefault();
				handleZoomIn();
				return;
			}

			if (meta && key === '-') {
				event.preventDefault();
				handleZoomOut();
				return;
			}

			if (event.key === 'Delete' || event.key === 'Backspace') {
				if (isInInput) return;
				const hasSelected =
					nodes.some((n) => n.selected) || edges.some((e) => e.selected);
				if (!hasSelected) return;
				event.preventDefault();
				handleDeleteSelected();
			}
		};

		window.addEventListener('keydown', handleKeyboard);
		return () => {
			window.removeEventListener('keydown', handleKeyboard);
		};
	});

	// Any selected node — drives the StylePanel.
	let selectedNode = $derived(nodes.find((n) => n.selected));

	// Style edits land on node.data so they ride existing persistence + history.
	function handleStyleChange(patch: NodeStyleData) {
		if (!selectedNode) return;
		updateNodeData(selectedNode.id, patch);
	}

	// Position edits replace node.position; xyflow re-renders from the new value.
	function handlePositionChange(x: number, y: number) {
		if (!selectedNode) return;
		const targetId = selectedNode.id;
		nodes = nodes.map((n) =>
			n.id === targetId ? { ...n, position: { x, y } } : n
		);
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

	// New connections use the orthogonal `connection` edge by default.
	// bendPoints starts empty — the routing layer L-shapes the initial path
	// from the source/target handle positions, and the user adds bends by
	// dragging ghost pills.
	function onConnect(connection: Connection) {
		const newEdge: Edge = {
			...connection,
			id: nanoid(),
			type: 'connection',
			data: { bendPoints: [] }
		};
		edges = addEdge(newEdge, edges);
	}

	let selectedEdge = $derived(
		edges.find((e: any) => e.selected)
	);

	function updateEdgeData(edgeId: string, newData: any) {
		edges = edges.map((e) =>
			e.id === edgeId ? { ...e, data: { ...e.data, ...newData}} : e
		);
	}
</script>

<main class="editor-root">
	<MenuBar />
	<ToolBar />
	<input
		type="file"
		accept=".easydraw,.json,application/xml,application/json"
		bind:this={fileInput}
		onchange={handleFileSelected}
		hidden
	/>
	<section
		class="canvas-shell"
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
				ondragover={onDragOver}
				ondrop={onDrop}
				onnodecontextmenu={handleContextMenu}
				onpaneclick={handlePaneClick}
				onpointerdown={handlePaneClick}
				onconnect={onConnect}
				onmove={handleViewportMove}
				snapGrid={editorActionsState.snapToGrid ? [20, 20] : undefined}
				nodesDraggable={!editorActionsState.locked}
				nodesConnectable={!editorActionsState.locked}
				elementsSelectable={!editorActionsState.locked}
				{nodeTypes}
				{edgeTypes}
				connectionMode={ConnectionMode.Loose}
				proOptions={{ hideAttribution: true }}
		>
			<CrowsFootMarkers />
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

		<Sidebar />

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
		{/if}


		{#if selectedEdge && selectedEdge.type === 'relationship'}
			{@const activeEdge = selectedEdge}
			{@const edgeData = activeEdge.data as { relationship: string } | undefined}
			<div class="edge-editor">
				<span class="context-label">RELATIONSHIP</span>
				<select
					value={edgeData?.relationship ?? 'one-to-many'}
					onchange={(e) => updateEdgeData(activeEdge.id, {
						relationship: e.currentTarget.value
					})}
				>
					<option value="one-to-one">One to One</option>
					<option value="one-to-many">One to Many</option>
					<option value="many-to-many">Many to Many</option>
				</select>
			</div>
		{/if}
	</section>

	<EditorFooter onSwitchPage={handleSwitchPage} onCreatePage={handleCreatePage} onDeletePage={handleDeletePage} />
</main>

<style>
    main {
        height: 100vh;
        display: flex;
        flex-direction: column;
    }

	/* Root editor layout: canvas on top, footer pinned as the last row. */
  .edge-editor {
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      background: #ffffff;
      border: 1px solid #D6D2C4;
      padding: 10px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.09);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 100;
  }

	/* Canvas shell reserves all remaining height above the footer. */
	.canvas-shell {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
	}

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

  .context-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #8A8B83;
      font-weight: 600;
  }

  select {
      border: 1px solid #D6D2C4;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 0.85rem;
      outline: none;
      background: #F5F3EF;
      color: #373A36;
  }
</style>