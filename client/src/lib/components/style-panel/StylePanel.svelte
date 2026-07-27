<script module lang="ts">
	export type TextAlign = 'left' | 'center' | 'right';

	export interface NodeStyleData {
		fillColor?: string;
		borderColor?: string;
		borderWidth?: number;
		rounded?: boolean;
		shadow?: boolean;
		opacity?: number;
		rotation?: number;
		textColor?: string;
		fontFamily?: string;
		fontSize?: number;
		bold?: boolean;
		italic?: boolean;
		underline?: boolean;
		textAlign?: TextAlign;
	}
</script>

<script lang="ts">
	import type { Node } from '@xyflow/svelte';
	import { getShape } from '$lib/flow/nodes/registry';
	import StyleTab from './StyleTab.svelte';
	import TextTab from './TextTab.svelte';
	import ArrangeTab from './ArrangeTab.svelte';

	type StyleTabId = 'style' | 'text' | 'panel' | 'arrange';

	interface Props {
		node: Node;
		/**
		 * Generic data patcher. Receives a Partial<NodeStyleData> for the
		 * Style/Text tabs and a Partial<NodeData> for shape-specific panels.
		 * Flow merges the patch into node.data either way.
		 */
		onStyleChange: (patch: Partial<NodeStyleData> & Record<string, unknown>) => void;
		/** Live typeface preview for the Text tab's font dropdown (hover = preview,
		 * click = commit via onStyleChange). No-ops for other tabs. */
		onFontPreview: (family: string) => void;
		onFontPreviewEnd: () => void;
		onPositionChange: (x: number, y: number) => void;
		onSizeChange: (width: number, height: number) => void;
		onBringToFront: () => void;
		onSendToBack: () => void;
		onDuplicate: () => void;
		onDelete: () => void;
	}

	let {
		node,
		onStyleChange,
		onFontPreview,
		onFontPreviewEnd,
		onPositionChange,
		onSizeChange,
		onBringToFront,
		onSendToBack,
		onDuplicate,
		onDelete
	}: Props = $props();

	let activeTab: StyleTabId = $state('style');

	// The shape registry tells us whether the selected node ships a custom
	// editor tab (e.g. EntityNode's Fields editor). No node-type-specific
	// branching here — StylePanel stays generic.
	let shape = $derived(node.type ? getShape(node.type) : undefined);
	let customPanel = $derived(shape?.panel);

	// If the user navigates to a node whose shape doesn't expose a custom
	// panel while that tab is active, fall back to Style.
	$effect(() => {
		if (!customPanel && activeTab === 'panel') {
			activeTab = 'style';
		}
	});

	// The style fields live on node.data so they survive page snapshots.
	let style = $derived((node.data ?? {}) as NodeStyleData);
</script>

<aside
	class="absolute top-4 right-4 z-50 flex max-h-[calc(100%-32px)] w-[280px] flex-col overflow-hidden
		rounded-xl border border-line bg-panel font-sans shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
>
	<div class="flex flex-shrink-0 border-b border-line" role="tablist" aria-label="Node styling tabs">
		{#snippet tab(id: StyleTabId, label: string)}
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === id}
				class="relative flex-1 cursor-pointer border-none bg-transparent py-3.5 text-[0.88rem]
					text-ink-soft transition-colors duration-[120ms] hover:text-mq-maroon
					[&.active]:font-semibold [&.active]:text-mq-maroon [&.active]:after:absolute
					[&.active]:after:right-3 [&.active]:after:bottom-[-1px] [&.active]:after:left-3
					[&.active]:after:h-0.5 [&.active]:after:rounded-[1px] [&.active]:after:bg-mq-maroon
					[&.active]:after:content-['']"
				class:active={activeTab === id}
				onclick={() => (activeTab = id)}
			>
				{label}
			</button>
		{/snippet}
		{@render tab('style', 'Style')}
		{@render tab('text', 'Text')}
		{#if customPanel}
			{@render tab('panel', customPanel.label)}
		{/if}
		{@render tab('arrange', 'Arrange')}
	</div>

	<div class="flex flex-col gap-5 overflow-y-auto p-[18px]">
		{#if activeTab === 'style'}
			<StyleTab {style} {onStyleChange} />
		{:else if activeTab === 'text'}
			<TextTab {style} {onStyleChange} {onFontPreview} {onFontPreviewEnd} />
		{:else if activeTab === 'panel' && customPanel}
			{@const PanelComponent = customPanel.component}
			<PanelComponent {node} onDataChange={onStyleChange} />
		{:else}
			<ArrangeTab
				{node}
				{style}
				{onStyleChange}
				{onPositionChange}
				{onSizeChange}
				{onBringToFront}
				{onSendToBack}
				{onDuplicate}
				{onDelete}
			/>
		{/if}
	</div>
</aside>
