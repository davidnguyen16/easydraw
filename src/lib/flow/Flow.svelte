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

	import RightSidebar from '$lib/components/RightSidebar.svelte';
	import EntityNode from '$lib/flow/nodes/EntityNode.svelte';
	import RelationshipEdge from '$lib/flow/edges/RelationshipEdge.svelte';
	import CrowsFootMarkers from './edges/CrowsFootMarkers.svelte';

	import EditorFooter from '$lib/components/EditorFooter.svelte';
	import MenuBar from '$lib/components/menubar/MenuBar.svelte';
	import ToolBar from '$lib/components/toolbar/ToolBar.svelte';
	import ContextMenu from '$lib/flow/ContextMenu.svelte';
	import RectangleNode from '$lib/flow/nodes/RectangleNode.svelte';
	import {
		clearCanvasDirtyPage,
		createPage,
		editorMetaData,
		editorStoreSvelte,
		exportEditorStateAsJSON,
		loadEditorStateFromJSON,
		loadEditorStateFromStorage,
		markCanvasDirtyPage,
		resetEditorState,
		saveActivePageToStorage,
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

	// Define all of our custom node here
	const nodeTypes = {
		RectangleNode: RectangleNode,
		EntityNode: EntityNode,
	};

	const edgeTypes = {
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

	// Clones nodes and also re-attaches the onEdit callback to each node's data, since functions cannot be cloned
	const cloneNodes = (items: Node[]): Node[] => {
		const cloned = typeof structuredClone === 'function'
			? structuredClone(items)
			: (JSON.parse(JSON.stringify(items)) as Node[]);

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

	const { screenToFlowPosition, zoomIn, zoomOut, fitView, getViewport, setViewport } = useSvelteFlow();

	const type = useDnD();

	const defaultEdgeOptions = {
		type: 'smoothstep'
	};

	// Drag and drop behavior
	const onDragOver = (event: DragEvent) => {
		event.preventDefault();

		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	};

	const onDrop = (event: DragEvent) => {
		event.preventDefault();

		if (!type.current) {
			return;
		}

		const position = screenToFlowPosition({
			x: event.clientX,
			y: event.clientY
		});

		let nodeData: any = { label: 'New Node' };

    	if (type.current === 'EntityNode') {
        	nodeData = {
            	label: 'New Entity',
            	fields: [
                	{ name: 'id', type: 'PK' },
                	{ name: 'field', type: 'varchar' },
                	{ name: 'field', type: 'varchar' }
            	]
        	};
    	}

		const newNodeId = `${Math.random()}`;

		const newNode = {
			id: `${Math.random()}`,
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

	function handleSaveAs() {
		persistCanvasToStore();
		const json = exportEditorStateAsJSON();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${editorMetaData.fileName || 'easydraw'}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
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

	function handleZoomIn() { zoomIn(); }
	function handleZoomOut() { zoomOut(); }
	function handleFitView() { fitView(); }

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
		const { x, y } = getViewport();
		setViewport({ x, y, zoom: percent / 100 });
	}

	// Fits the viewport to selected nodes, or to all nodes if none selected.
	function handleFitSelection() {
		const selected = nodes.filter((n) => n.selected);
		if (selected.length === 0) {
			fitView();
			return;
		}
		fitView({ nodes: selected.map((n) => ({ id: n.id })) });
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
		undo: handleUndo,
		redo: handleRedo,
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
				handleSave();
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

	// Reactive state to find the currently selected EntityNode
	let selectedEntityNode = $derived(
        nodes.find((n: any) => n.selected && n.type === 'EntityNode')
    );

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

	// Function to handle new connections between nodes
	function onConnect(connection: Connection) {
		const newEdge: Edge = {
			...connection,
			id: `${Math.random()}`,
			type: 'relationship',
			data: { relationship: 'one-to-many' } // default
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
		accept=".json,application/json"
		bind:this={fileInput}
		onchange={handleFileSelected}
		hidden
	/>
	<section class="canvas-shell" bind:clientWidth bind:clientHeight>
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

		{#if selectedEntityNode}
			{@const activeNode = selectedEntityNode}
			<RightSidebar
				node={activeNode}
				onUpdate={(updatedData: any) => updateNodeData(activeNode.id, updatedData)}
			/>
		{/if}

		{#if selectedEdge}
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

	<EditorFooter onSwitchPage={handleSwitchPage} onCreatePage={handleCreatePage} />
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
      background: white;
      padding: 10px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
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

	/* Keep SvelteFlow sized to the available canvas shell area. */
	.canvas-shell :global(.svelte-flow) {
		width: 100%;
		height: 100%;
	}

  .context-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #888;
      font-weight: 600;
  }

  select {
      border: 1px solid #eee;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 0.85rem;
      outline: none;
      background: #f8f9fa;
  }
</style>