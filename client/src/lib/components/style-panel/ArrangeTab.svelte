<script lang="ts">
	import { RotateCcw, RotateCw } from '@lucide/svelte';
	import type { Node } from '@xyflow/svelte';
	import type { NodeStyleData } from '$lib/components/style-panel/StylePanel.svelte';
	import {
		nearestRotationEquivalent,
		normalizeRotation,
		toFiniteRotation
	} from '$lib/flow/nodes/style-utils';
	import {
		ACTION_BTN,
		ACTION_BTN_DANGER,
		GROUP,
		GROUP_LABEL,
		NUM_FIELD,
		NUM_FIELD_INPUT,
		NUM_FIELD_LABEL,
		ROW,
		ROW_LABEL,
		STEPPER_BTN
	} from './ui';

	interface Props {
		node: Node;
		style: NodeStyleData;
		onStyleChange: (patch: Partial<NodeStyleData>) => void;
		onPositionChange: (x: number, y: number) => void;
		onSizeChange: (width: number, height: number) => void;
		onBringToFront: () => void;
		onSendToBack: () => void;
		onDuplicate: () => void;
		onDelete: () => void;
	}

	let {
		node,
		style,
		onStyleChange,
		onPositionChange,
		onSizeChange,
		onBringToFront,
		onSendToBack,
		onDuplicate,
		onDelete
	}: Props = $props();

	// Inputs pull live values from the node, but need local state so we can
	// debounce commits until blur/Enter.
	let nodeX = $derived(Math.round(node.position?.x ?? 0));
	let nodeY = $derived(Math.round(node.position?.y ?? 0));
	let nodeW = $derived(
		Math.round((node.measured?.width as number) ?? (node.width as number) ?? 0)
	);
	let nodeH = $derived(
		Math.round((node.measured?.height as number) ?? (node.height as number) ?? 0)
	);

	let xInput = $state(0);
	let yInput = $state(0);
	let wInput = $state(0);
	let hInput = $state(0);

	// Seed and re-seed inputs from the selected node's live geometry.
	$effect(() => {
		xInput = nodeX;
	});
	$effect(() => {
		yInput = nodeY;
	});
	$effect(() => {
		wInput = nodeW;
	});
	$effect(() => {
		hInput = nodeH;
	});

	function commitPosition() {
		onPositionChange(xInput, yInput);
	}

	function commitSize() {
		onSizeChange(Math.max(1, wInput), Math.max(1, hInput));
	}

	// ─── Rotation ────────────────────────────────────────────────────────
	let rotationRaw = $derived(toFiniteRotation(style.rotation));
	let rotation = $derived(normalizeRotation(rotationRaw));
	let rotationDraft = $state<string | null>(null);

	function setRotation(next: number) {
		rotationDraft = null;
		onStyleChange({ rotation: toFiniteRotation(next) });
	}

	function commitRotation() {
		if (rotationDraft !== null) {
			const n = parseFloat(rotationDraft);
			if (!Number.isNaN(n)) {
				setRotation(nearestRotationEquivalent(n, rotationRaw));
			}
		}
		rotationDraft = null;
	}

	function onRotationKeydown(event: KeyboardEvent) {
		const input = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			commitRotation();
			input.blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			rotationDraft = null;
			input.blur();
		}
	}
</script>

<section class={GROUP}>
	<h3 class={GROUP_LABEL}>POSITION</h3>
	<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
		<label class={NUM_FIELD}>
			<span class={NUM_FIELD_LABEL}>X</span>
			<input
				class={NUM_FIELD_INPUT}
				type="number"
				bind:value={xInput}
				onchange={commitPosition}
				onblur={commitPosition}
			/>
		</label>
		<label class={NUM_FIELD}>
			<span class={NUM_FIELD_LABEL}>Y</span>
			<input
				class={NUM_FIELD_INPUT}
				type="number"
				bind:value={yInput}
				onchange={commitPosition}
				onblur={commitPosition}
			/>
		</label>
	</div>
</section>

<section class={GROUP}>
	<h3 class={GROUP_LABEL}>SIZE</h3>
	<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
		<label class={NUM_FIELD}>
			<span class={NUM_FIELD_LABEL}>W</span>
			<input
				class={NUM_FIELD_INPUT}
				type="number"
				bind:value={wInput}
				onchange={commitSize}
				onblur={commitSize}
			/>
		</label>
		<label class={NUM_FIELD}>
			<span class={NUM_FIELD_LABEL}>H</span>
			<input
				class={NUM_FIELD_INPUT}
				type="number"
				bind:value={hInput}
				onchange={commitSize}
				onblur={commitSize}
			/>
		</label>
	</div>
</section>

<section class={GROUP}>
	<h3 class={GROUP_LABEL}>ROTATION</h3>
	<div class={ROW}>
		<span class={ROW_LABEL}>Angle</span>
		<div class="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-1 py-0.5">
			<button
				type="button"
				class={STEPPER_BTN}
				aria-label="Rotate counterclockwise 1 degree"
				onclick={() => setRotation(rotationRaw - 1)}
			>
				<RotateCcw size={14} strokeWidth={2} />
			</button>
			<label class="flex items-center">
				<input
					class="w-10 min-w-0 border-none bg-transparent p-0 text-right text-[0.85rem]
						tabular-nums text-ink-soft outline-none [appearance:textfield]
						[&::-webkit-inner-spin-button]:appearance-none
						[&::-webkit-outer-spin-button]:appearance-none"
					type="text"
					inputmode="numeric"
					aria-label="Rotation degrees"
					value={rotationDraft ?? `${rotation}`}
					oninput={(e) => (rotationDraft = e.currentTarget.value)}
					onfocus={(e) => {
						rotationDraft = `${rotation}`;
						e.currentTarget.select();
					}}
					onblur={commitRotation}
					onkeydown={onRotationKeydown}
				/>
				<span class="pl-0.5 text-[0.78rem] text-ink-muted">°</span>
			</label>
			<button
				type="button"
				class={STEPPER_BTN}
				aria-label="Rotate clockwise 1 degree"
				onclick={() => setRotation(rotationRaw + 1)}
			>
				<RotateCw size={14} strokeWidth={2} />
			</button>
		</div>
	</div>
	<button
		type="button"
		class="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md
			border border-line bg-white p-2.5 text-[0.85rem] font-medium text-ink-soft
			transition-colors duration-[120ms] hover:border-mq-maroon hover:text-mq-maroon"
		onclick={() => setRotation(rotationRaw + 90)}
	>
		<RotateCw size={15} strokeWidth={2} />
		Rotate 90°
	</button>
</section>

<section class={GROUP}>
	<h3 class={GROUP_LABEL}>ORDER</h3>
	<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
		<button type="button" class={ACTION_BTN} onclick={onBringToFront}>To front</button>
		<button type="button" class={ACTION_BTN} onclick={onSendToBack}>To back</button>
	</div>
</section>

<section class={GROUP}>
	<h3 class={GROUP_LABEL}>ACTIONS</h3>
	<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
		<button type="button" class={ACTION_BTN} onclick={onDuplicate}>Duplicate</button>
		<button type="button" class={ACTION_BTN_DANGER} onclick={onDelete}>Delete</button>
	</div>
</section>
