<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import {
		SvelteFlow,
		Controls,
		Background,
		BackgroundVariant,
		MiniMap,
		useSvelteFlow,
		addEdge,
		type Node,
		type Edge,
		type NodeEventWithPointer, ConnectionMode,
		type Connection
	} from '@xyflow/svelte';
	import { get } from 'svelte/store';

	import { setContext } from 'svelte';

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
		editorStoreSvelte,
		loadEditorStateFromStorage,
		markCanvasDirtyPage,
		saveActivePageToStorage,
		switchPage,
		updateActiveGraph,
		visibleUnsavedPageIdsStore,
	} from '$lib/stores/editor.store.svelte';

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
	const cloneNodes = (items: Node[]) => {
		const cloned = typeof structuredClone === 'function'
			? structuredClone(items)
			: (JSON.parse(JSON.stringify(items)) as Node[]);

		return cloned.map((n) => ({
			...n,
			data: {
					...n.data,
					onEdit: (newData: any) => updateNodeData(n.id, newData)
			}
		}));
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

	const { screenToFlowPosition } = useSvelteFlow();

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

	// Marks active page as dirty immediately when canvas diverges from last synced state.
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

		// Saves the current active page snapshot when user presses Ctrl/Cmd + S.
		const handleSaveShortcut = (event: KeyboardEvent) => {
			const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
			if (!isSaveShortcut) return;

			event.preventDefault();
			persistCanvasToStore();
			saveActivePageToStorage();
		};

		// Deletes selected nodes and edges when user presses Delete or Backspace.
		const handleDeleteKey = (event: KeyboardEvent) => {
			// Ignore if user is typing in an input/textarea (so they can edit text normally)
			const target = event.target as HTMLElement;
			if (
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable
			) {
				return;
			}

			if (event.key !== 'Delete' && event.key !== 'Backspace') {
				return;
			}

			const hasSelectedNodes = nodes.some((n) => n.selected);
			const hasSelectedEdges = edges.some((e) => e.selected);

			if (!hasSelectedNodes && !hasSelectedEdges) return;

			event.preventDefault();

			if (hasSelectedNodes) {
				nodes = nodes.filter((n) => !n.selected);
			}
			if (hasSelectedEdges) {
				edges = edges.filter((e) => !e.selected);
			}
		};

		window.addEventListener('keydown', handleSaveShortcut);
		window.addEventListener('keydown', handleDeleteKey);
		return () => {
			window.removeEventListener('keydown', handleSaveShortcut);
			window.removeEventListener('keydown', handleDeleteKey);
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
				{nodeTypes}
				{edgeTypes}
				connectionMode={ConnectionMode.Loose}
				proOptions={{ hideAttribution: true }}
		>
			<CrowsFootMarkers />
			<Background variant={BackgroundVariant.Dots} />
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
			<MiniMap />
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

		<Controls position="top-right" />
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