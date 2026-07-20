<script lang="ts">
	import { Handle, NodeResizer, Position, useSvelteFlow, type NodeProps } from '@xyflow/svelte';
	import { toFiniteRotation } from '../style-utils';
	import { getNetworkDefinition } from './definitions';
	import NetworkGlyph from './NetworkGlyph.svelte';

	let { id, type, data, selected, isConnectable }: NodeProps = $props();
	let { updateNodeData } = useSvelteFlow();

	const definition = $derived(getNetworkDefinition(type));
	const isContainer = $derived(definition?.kind === 'container');
	const handleBounds = $derived(
		definition?.handleBounds ?? { top: 0, right: 100, bottom: 100, left: 0 }
	);

	const fillColor = $derived((data.fillColor as string) ?? '#ffffff');
	const borderColor = $derived((data.borderColor as string) ?? '#2c2c2a');
	const borderWidth = $derived(Number(data.borderWidth ?? 1.5));
	const accentColor = $derived((data.accentColor as string) ?? '#a6192e');
	const shadow = $derived((data.shadow as boolean) ?? false);
	const opacity = $derived(Math.max(0, Math.min(100, Number(data.opacity ?? 100))));
	const visualOpacity = $derived(Number.isFinite(opacity) ? opacity / 100 : 1);
	const rotation = $derived(toFiniteRotation(data.rotation));
	const strokeScale = $derived(
		Number.isFinite(borderWidth) ? Math.max(0, Math.min(10 / 1.8, borderWidth / 1.8)) : 1
	);

	const textColor = $derived((data.textColor as string) ?? '#2c2c2a');
	const fontFamily = $derived((data.fontFamily as string) ?? 'inherit');
	const fontSize = $derived((data.fontSize as number) ?? 13);
	const bold = $derived((data.bold as boolean) ?? false);
	const italic = $derived((data.italic as boolean) ?? false);
	const underline = $derived((data.underline as boolean) ?? false);
	const textAlign = $derived((data.textAlign as string) ?? (isContainer ? 'left' : 'center'));
	const labelTransform = $derived(rotation ? `rotate(${-rotation}deg)` : undefined);

	const labelStyle = $derived(
		[
			`color: ${textColor}`,
			`font-family: ${fontFamily}`,
			`font-size: ${fontSize}px`,
			`font-weight: ${bold ? '700' : isContainer ? '600' : '500'}`,
			`font-style: ${italic ? 'italic' : 'normal'}`,
			`text-decoration: ${underline ? 'underline' : 'none'}`,
			`text-align: ${textAlign}`,
			'line-height: 1.25'
		].join('; ')
	);

	const containerStyle = $derived(
		[
			`filter: ${shadow ? 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.18))' : 'none'}`,
			`transform: rotate(${rotation}deg)`,
			'transform-origin: center',
			'transition: transform 120ms ease'
		].join('; ')
	);

	let labelBoxEl = $state<HTMLDivElement>();
	let inputEl = $state<HTMLTextAreaElement>();
	let editing = $state(false);

	function fitLabelTextarea() {
		const element = inputEl;
		if (!element) return;
		element.style.height = 'auto';
		element.style.height = `${element.scrollHeight}px`;
	}

	function startEditing() {
		editing = true;
		requestAnimationFrame(() => {
			inputEl?.focus();
			inputEl?.select();
			fitLabelTextarea();
		});
	}

	function onInput(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		updateNodeData(id, { label: target.value });
		fitLabelTextarea();
	}

	function onLabelKeydown(event: KeyboardEvent) {
		event.stopPropagation();
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			inputEl?.blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			inputEl?.blur();
		}
	}

	function onLabelBlur() {
		editing = false;
		inputEl?.setSelectionRange(0, 0);
		window.getSelection()?.removeAllRanges();
	}

	$effect(() => {
		if (editing && !selected) inputEl?.blur();
	});

	$effect(() => {
		if (!editing) return;
		const onPointerDown = (event: PointerEvent) => {
			if (event.target instanceof Node && inputEl && !inputEl.contains(event.target)) {
				inputEl.blur();
			}
		};
		window.addEventListener('pointerdown', onPointerDown, true);
		return () => window.removeEventListener('pointerdown', onPointerDown, true);
	});

	$effect(() => {
		data.label;
		labelStyle;
		requestAnimationFrame(fitLabelTextarea);
	});

	$effect(() => {
		const element = labelBoxEl;
		if (!element) return;
		const observer = new ResizeObserver(fitLabelTextarea);
		observer.observe(element);
		return () => observer.disconnect();
	});

	const CONNECTION_HANDLE_CLASS =
		'network-conn pointer-events-none opacity-0 transition-opacity duration-[120ms] ' +
		'group-hover:pointer-events-auto group-hover:opacity-100 ' +
		'group-[.selected]:pointer-events-auto group-[.selected]:opacity-100';
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="group relative flex h-full w-full items-center justify-center"
	class:selected
	class:network-container={isContainer}
	style={containerStyle}
	ondblclick={(event) => {
		event.stopPropagation();
		startEditing();
	}}
>
	{#if definition}
		<NetworkGlyph
			id={definition.id}
			mode="canvas"
			{fillColor}
			strokeColor={borderColor}
			{accentColor}
			{strokeScale}
			opacity={visualOpacity}
			class="pointer-events-none absolute inset-0 h-full w-full overflow-visible transition-[filter]
				group-[.selected]:drop-shadow-[0_0_2px_#a6192e]"
		/>
	{/if}

	<NodeResizer
		isVisible={selected}
		minWidth={definition?.minWidth ?? 56}
		minHeight={definition?.minHeight ?? 44}
		keepAspectRatio={definition?.keepAspectRatio ?? true}
		handleClass="network-resize-anchor"
		lineClass="network-resize-line"
	/>

	{#if !isContainer}
		<Handle
			type="source"
			position={Position.Top}
			{isConnectable}
			id="top"
			class={CONNECTION_HANDLE_CLASS}
			style={`top: ${handleBounds.top}%`}
		/>
		<Handle
			type="source"
			position={Position.Right}
			{isConnectable}
			id="right"
			class={CONNECTION_HANDLE_CLASS}
			style={`right: ${100 - handleBounds.right}%`}
		/>
		<Handle
			type="source"
			position={Position.Bottom}
			{isConnectable}
			id="bottom"
			class={CONNECTION_HANDLE_CLASS}
			style={`bottom: ${100 - handleBounds.bottom}%`}
		/>
		<Handle
			type="source"
			position={Position.Left}
			{isConnectable}
			id="left"
			class={CONNECTION_HANDLE_CLASS}
			style={`left: ${handleBounds.left}%`}
		/>
	{/if}

	<div
		bind:this={labelBoxEl}
		class="pointer-events-auto select-none {isContainer
			? 'absolute top-0 left-0 flex h-[18.75%] w-full items-center px-4 py-1'
			: 'absolute top-full left-1/2 mt-1 w-[max(100%,140px)] px-1 text-center [translate:-50%_0]'}"
		style:opacity={visualOpacity}
		style:transform={labelTransform}
	>
		<textarea
			bind:this={inputEl}
			rows="1"
			value={String(data.label ?? definition?.label ?? '')}
			oninput={onInput}
			readonly={!editing}
			onkeydown={onLabelKeydown}
			onblur={onLabelBlur}
			onpointerdown={(event) => editing && event.stopPropagation()}
			spellcheck="false"
			aria-label="Network node label"
			class="nodrag m-0 block w-full resize-none appearance-none overflow-hidden border-none
				bg-transparent p-0 whitespace-pre-wrap outline-none break-words [overflow-wrap:anywhere]
				{editing ? 'pointer-events-auto cursor-text select-text' : 'pointer-events-none cursor-[inherit]'}"
			style={labelStyle}
		></textarea>
	</div>
</div>

<style>
	:global(.svelte-flow__handle.network-conn) {
		width: 10px;
		height: 10px;
		background: #ffffff;
		border: 1.5px solid #a6192e;
		border-radius: 50%;
	}

	:global(.svelte-flow__resize-control.handle.network-resize-anchor) {
		width: 15px;
		height: 15px;
		background: #ffffff;
		border: 2px solid #a6192e;
		border-radius: 4px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
	}

	:global(.svelte-flow__resize-control.line.network-resize-line) {
		border-color: transparent;
		background: transparent;
	}

	:global(.svelte-flow__resize-control.line.left.network-resize-line),
	:global(.svelte-flow__resize-control.line.right.network-resize-line) {
		width: 8px;
	}

	:global(.svelte-flow__resize-control.line.top.network-resize-line),
	:global(.svelte-flow__resize-control.line.bottom.network-resize-line) {
		height: 8px;
	}
</style>
