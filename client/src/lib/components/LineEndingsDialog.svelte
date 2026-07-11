<script lang="ts">
	/**
	 * "Line endings" dialog (opened from the More button in the connection
	 * panel's Start/End dropdowns). Lets the user tick which markers from the
	 * catalog appear in those dropdowns, browsing by category (Standard, UML,
	 * BPMN, ERD, …).
	 *
	 * Edits happen on a local DRAFT; Apply commits it to the marker palette
	 * store (persisted to localStorage), while Cancel / X / Escape / backdrop
	 * click discard it.
	 */
	import { ArrowDown, Check, Minus, X } from '@lucide/svelte';
	import MarkerPreview from './MarkerPreview.svelte';
	import {
		MARKER_CATEGORIES,
		getMarkersByCategory,
		type MarkerCategory
	} from '$lib/flow/edges/markers';
	import { markerPalette, setEnabledMarkers } from '$lib/stores/markers.store.svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let activeCategory = $state<'all' | MarkerCategory>('all');
	let draft = $state<string[]>([...markerPalette.enabled]);
	let listEl = $state<HTMLDivElement>();

	const visible = $derived(getMarkersByCategory(activeCategory));
	const allChecked = $derived(visible.every((d) => draft.includes(d.id)));
	const someChecked = $derived(visible.some((d) => draft.includes(d.id)));

	function toggle(id: string) {
		draft = draft.includes(id) ? draft.filter((x) => x !== id) : [...draft, id];
	}

	// Select-all operates on the rows the current category shows.
	function toggleAll() {
		const ids = visible.map((d) => d.id as string);
		draft = allChecked
			? draft.filter((x) => !ids.includes(x))
			: [...new Set([...draft, ...ids])];
	}

	function apply() {
		setEnabledMarkers(draft);
		onClose();
	}

	function scrollDown() {
		listEl?.scrollBy({ top: 220, behavior: 'smooth' });
	}

	$effect(() => {
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKeydown, true);
		return () => window.removeEventListener('keydown', onKeydown, true);
	});
</script>

{#snippet checkbox(checked: boolean, indeterminate: boolean)}
	<span
		class="inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] text-white
			{checked || indeterminate ? 'bg-mq-red' : 'bg-line-dropdown'}"
	>
		{#if indeterminate}
			<Minus size={12} strokeWidth={3} />
		{:else if checked}
			<Check size={12} strokeWidth={3} />
		{/if}
	</span>
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-[300] flex items-center justify-center bg-ink/45"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
>
	<div
		class="flex max-h-[calc(100vh-64px)] w-[640px] max-w-[calc(100vw-48px)] flex-col overflow-hidden
			rounded-xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
		role="dialog"
		aria-modal="true"
		aria-label="Line endings"
	>
		<header class="flex shrink-0 items-center justify-between border-b border-line-soft px-5 py-4">
			<h2 class="m-0 text-[1.15rem] font-semibold text-ink">Line endings</h2>
			<button
				type="button"
				class="inline-flex cursor-pointer rounded-md p-1 text-ink-soft hover:bg-surface-hover
					hover:text-ink"
				aria-label="Close"
				onclick={onClose}
			>
				<X size={18} />
			</button>
		</header>

		<div class="flex min-h-0 flex-1">
			<nav
				class="flex w-[140px] shrink-0 flex-col overflow-y-auto border-r border-line-soft py-2.5"
				aria-label="Line ending categories"
			>
				{#each MARKER_CATEGORIES as c (c.id)}
					<button
						type="button"
						class="cursor-pointer border-l-[3px] px-4 py-2.5 text-left text-[0.9rem]
							{activeCategory === c.id
							? 'border-l-mq-red bg-mq-pink font-semibold text-mq-red'
							: 'border-l-transparent text-ink-soft hover:bg-panel'}"
						onclick={() => (activeCategory = c.id)}
					>
						{c.label}
					</button>
				{/each}
			</nav>

			<div class="flex min-h-0 min-w-0 flex-1 flex-col">
				<button
					type="button"
					class="flex shrink-0 cursor-pointer items-center gap-3 border-b border-line-soft px-5 py-3.5
						text-[0.92rem] text-ink"
					onclick={toggleAll}
				>
					{@render checkbox(allChecked, someChecked && !allChecked)}
					Select all
				</button>
				<div class="max-h-[380px] min-h-[200px] flex-1 overflow-y-auto py-2" bind:this={listEl}>
					{#each visible as d (d.id)}
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-3.5 px-5 py-2.5 hover:bg-panel"
							aria-pressed={draft.includes(d.id)}
							title={d.label}
							onclick={() => toggle(d.id)}
						>
							{@render checkbox(draft.includes(d.id), false)}
							<MarkerPreview kind={d.id} end="end" width={330} />
						</button>
					{/each}
				</div>
			</div>
		</div>

		<footer
			class="relative flex shrink-0 items-center justify-center border-t border-line-soft px-5 py-3"
		>
			<button
				type="button"
				class="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border
					border-line bg-white text-ink-soft hover:bg-panel"
				aria-label="Scroll list down"
				onclick={scrollDown}
			>
				<ArrowDown size={16} />
			</button>
			<div class="absolute right-5 flex gap-2.5">
				<button
					type="button"
					class="cursor-pointer rounded-lg border border-line bg-white px-[18px] py-[9px]
						text-[0.88rem] text-ink-soft hover:bg-panel"
					onclick={onClose}
				>
					Cancel
				</button>
				<button
					type="button"
					class="cursor-pointer rounded-lg border border-mq-red bg-mq-red px-5 py-[9px]
						text-[0.88rem] font-semibold text-white hover:bg-mq-red-hover"
					onclick={apply}
				>
					Apply
				</button>
			</div>
		</footer>
	</div>
</div>
