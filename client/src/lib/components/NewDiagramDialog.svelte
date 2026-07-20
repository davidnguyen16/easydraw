<script lang="ts">
	import { tick } from 'svelte';
	import { X } from '@lucide/svelte';
	import { DIAGRAM_TYPES, type DiagramType } from '$lib/diagram-types';

	let {
		open = $bindable(false),
		onCreate
	}: {
		open?: boolean;
		onCreate: (payload: { name: string; type: DiagramType }) => Promise<void> | void;
	} = $props();

	const MAX_LENGTH = 100;

	let name = $state('Untitled Diagram');
	let type = $state<DiagramType>('erd');
	let loading = $state(false);
	let touched = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);

	const trimmed = $derived(name.trim());
	const isValid = $derived(trimmed.length > 0);
	const showError = $derived(touched && !isValid);

	// Reset fields + focus/select the name each time the dialog opens.
	$effect(() => {
		if (open) {
			name = 'Untitled Diagram';
			type = 'erd';
			touched = false;
			loading = false;
			tick().then(() => {
				inputEl?.focus();
				inputEl?.select();
			});
		}
	});

	function close() {
		if (!loading) open = false;
	}

	async function handleCreate() {
		touched = true;
		if (!isValid || loading) return;
		loading = true;
		try {
			await onCreate({ name: trimmed, type });
			open = false;
		} finally {
			loading = false;
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape') close();
	}}
/>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="new-diagram-title"
	>
		<!-- backdrop -->
		<button class="absolute inset-0 bg-black/40" onclick={close} aria-label="Close" tabindex="-1"
		></button>

		<!-- card -->
		<div class="relative z-10 w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
			<div class="mb-5 flex items-center justify-between">
				<h2 id="new-diagram-title" class="text-lg font-semibold text-ink">New Diagram</h2>
				<button
					onclick={close}
					aria-label="Close"
					class="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
				>
					<X size={18} />
				</button>
			</div>

			<!-- Name -->
			<div class="mb-5">
				<label for="diagram-name" class="mb-1.5 block text-sm font-medium text-ink">Name</label>
				<input
					bind:this={inputEl}
					bind:value={name}
					id="diagram-name"
					maxlength={MAX_LENGTH}
					placeholder="My Diagram"
					onblur={() => (touched = true)}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							handleCreate();
						}
					}}
					aria-invalid={showError}
					class="w-full rounded-lg border px-3 py-2.5 text-ink outline-none placeholder:text-ink-muted focus:ring-1 {showError
						? 'border-mq-red focus:border-mq-red focus:ring-mq-red'
						: 'border-line focus:border-mq-red focus:ring-mq-red'}"
				/>
				{#if showError}
					<p class="mt-1 text-xs text-mq-red">Diagram name is required.</p>
				{/if}
			</div>

			<!-- Type -->
			<div class="mb-6">
				<span class="mb-1.5 block text-sm font-medium text-ink">Type</span>
				<div
					class="grid grid-cols-2 gap-2 max-[420px]:grid-cols-1"
					role="radiogroup"
					aria-label="Diagram type"
				>
					{#each DIAGRAM_TYPES as dt (dt.value)}
						{@const selected = type === dt.value}
						{@const Icon = dt.icon}
						<button
							type="button"
							role="radio"
							aria-checked={selected}
							onclick={() => (type = dt.value)}
							class="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors {selected
								? 'border-mq-red bg-mq-red/5 ring-1 ring-mq-red/20'
								: 'border-line hover:bg-surface-hover'}"
						>
							<Icon size={20} class="mt-0.5 flex-shrink-0 {selected ? 'text-mq-red' : 'text-ink-muted'}" />
							<div class="min-w-0">
								<p class="text-sm font-medium {selected ? 'text-mq-red' : 'text-ink'}">{dt.label}</p>
								<p class="text-xs text-ink-muted">{dt.description}</p>
							</div>
						</button>
					{/each}
				</div>
			</div>

			<!-- Footer -->
			<div class="flex justify-end gap-2">
				<button
					type="button"
					onclick={close}
					disabled={loading}
					class="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleCreate}
					disabled={!isValid || loading}
					class="rounded-lg bg-mq-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mq-red-hover disabled:opacity-50"
				>
					{loading ? 'Creating…' : 'Create'}
				</button>
			</div>
		</div>
	</div>
{/if}
