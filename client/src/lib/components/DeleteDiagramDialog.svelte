<script lang="ts">
	import { X, Loader2 } from '@lucide/svelte';

	let {
		open = $bindable(false),
		name = '',
		onConfirm
	}: {
		open?: boolean;
		name?: string;
		onConfirm: () => Promise<void>;
	} = $props();

	let loading = $state(false);

	function close() {
		if (!loading) open = false;
	}

	async function confirm() {
		if (loading) return;
		loading = true;
		try {
			await onConfirm();
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
		aria-labelledby="delete-diagram-title"
	>
		<!-- backdrop -->
		<button class="absolute inset-0 bg-black/40" onclick={close} aria-label="Close" tabindex="-1"
		></button>

		<!-- card -->
		<div class="relative z-10 w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
			<div class="mb-2 flex items-start justify-between">
				<h2 id="delete-diagram-title" class="text-lg font-semibold text-ink">Delete diagram?</h2>
				<button
					onclick={close}
					disabled={loading}
					aria-label="Close"
					class="-mt-1 -mr-1 rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50"
				>
					<X size={18} />
				</button>
			</div>

			<p class="text-sm text-ink-muted">
				Are you sure you want to permanently delete this diagram?
			</p>
			<p class="mt-4 text-sm font-semibold text-ink">“{name}”</p>
			<p class="mt-3 text-sm text-ink-muted">This action cannot be undone.</p>

			<div class="mt-6 flex justify-end gap-2">
				<button
					onclick={close}
					disabled={loading}
					class="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					onclick={confirm}
					disabled={loading}
					class="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
				>
					{#if loading}
						<Loader2 size={16} class="animate-spin" />
						Deleting…
					{:else}
						Delete
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
