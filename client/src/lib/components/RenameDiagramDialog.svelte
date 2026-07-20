<script lang="ts">
	import { tick } from 'svelte';
	import { X, Loader2 } from '@lucide/svelte';

	let {
		open = $bindable(false),
		currentName = '',
		onSave
	}: {
		open?: boolean;
		currentName?: string;
		onSave: (name: string) => Promise<void>;
	} = $props();

	let name = $state('');
	let loading = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);

	const trimmed = $derived(name.trim());
	// Enabled only when there's a real, different name.
	const changed = $derived(trimmed !== '' && trimmed !== currentName);

	// Reset to the current name + focus/select each time the dialog opens.
	$effect(() => {
		if (open) {
			name = currentName;
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

	async function save() {
		if (!changed || loading) return;
		loading = true;
		try {
			await onSave(trimmed);
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
		aria-labelledby="rename-diagram-title"
	>
		<!-- backdrop -->
		<button class="absolute inset-0 bg-black/40" onclick={close} aria-label="Close" tabindex="-1"
		></button>

		<!-- card -->
		<div class="relative z-10 w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
			<div class="mb-5 flex items-start justify-between">
				<h2 id="rename-diagram-title" class="text-lg font-semibold text-ink">Rename diagram</h2>
				<button
					onclick={close}
					disabled={loading}
					aria-label="Close"
					class="-mt-1 -mr-1 rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50"
				>
					<X size={18} />
				</button>
			</div>

			<div class="flex flex-col gap-1.5">
				<label for="rename-input" class="text-sm font-medium text-ink">Name</label>
				<input
					bind:this={inputEl}
					bind:value={name}
					id="rename-input"
					maxlength={100}
					disabled={loading}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							save();
						}
					}}
					class="w-full rounded-lg border border-line px-3 py-2.5 text-ink outline-none focus:border-mq-red focus:ring-1 focus:ring-mq-red disabled:opacity-60"
				/>
			</div>

			<div class="mt-6 flex justify-end gap-2">
				<button
					onclick={close}
					disabled={loading}
					class="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					onclick={save}
					disabled={!changed || loading}
					class="flex items-center gap-2 rounded-lg bg-mq-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mq-red-hover disabled:opacity-50"
				>
					{#if loading}
						<Loader2 size={16} class="animate-spin" />
						Saving…
					{:else}
						Save
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
