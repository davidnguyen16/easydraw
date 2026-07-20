<script lang="ts">
	import { tick } from 'svelte';
	import { Download, Loader2 } from '@lucide/svelte';

	let {
		open = $bindable(false),
		onConfirm
	}: {
		open?: boolean;
		onConfirm: () => Promise<void>;
	} = $props();

	let confirmText = $state('');
	let deleteError = $state<string | null>(null);
	let isDeleting = $state(false);
	let confirmInput = $state<HTMLInputElement | null>(null);

	const canDelete = $derived(confirmText === 'DELETE' && !isDeleting);

	// Reset stale confirmation/error state and focus the destructive-action
	// guard every time the dialog opens.
	$effect(() => {
		if (open) {
			confirmText = '';
			deleteError = null;
			isDeleting = false;
			tick().then(() => confirmInput?.focus());
		} else {
			confirmText = '';
			deleteError = null;
		}
	});

	function close() {
		if (!isDeleting) open = false;
	}

	async function confirm(event: SubmitEvent) {
		event.preventDefault();
		if (!canDelete) return;

		isDeleting = true;
		deleteError = null;
		try {
			await onConfirm();
		} catch (error) {
			deleteError =
				error instanceof Error
					? error.message
					: 'Could not delete account. Please try again.';
			isDeleting = false;
		}
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === 'Escape') close();
	}}
/>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-account-title"
		aria-describedby="delete-account-description"
	>
		<button
			type="button"
			class="absolute inset-0 bg-black/40"
			onclick={close}
			disabled={isDeleting}
			aria-label="Close dialog"
			tabindex="-1"
		></button>

		<form
			onsubmit={confirm}
			class="relative z-10 w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-xl"
		>
			<div>
				<h2 id="delete-account-title" class="text-lg font-semibold text-ink">
					Delete account permanently?
				</h2>
				<p id="delete-account-description" class="mt-2 text-sm leading-6 text-ink-muted">
					This will permanently delete your account and all associated diagrams. This
					action cannot be undone.
				</p>
			</div>

			<div class="mt-5 flex items-start gap-2 rounded-lg bg-panel p-3 text-xs text-ink-muted">
				<Download size={15} class="mt-0.5 flex-shrink-0" />
				<span>
					Need your data? Export your diagrams from the dashboard before deleting your
					account.
				</span>
			</div>

			<div class="mt-5">
				<label for="confirm-delete" class="block text-xs text-ink-muted">
					Type <span class="font-semibold text-ink">DELETE</span> to confirm
				</label>
				<input
					bind:this={confirmInput}
					bind:value={confirmText}
					id="confirm-delete"
					type="text"
					placeholder="DELETE"
					autocomplete="off"
					disabled={isDeleting}
					aria-invalid={deleteError !== null}
					aria-describedby={deleteError ? 'delete-account-error' : undefined}
					class="mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink
						outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1
						focus:ring-mq-red disabled:cursor-not-allowed disabled:opacity-60"
				/>
				{#if deleteError}
					<p id="delete-account-error" class="mt-2 text-xs text-red-600" role="alert">
						{deleteError}
					</p>
				{/if}
			</div>

			<div class="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
				<button
					type="button"
					onclick={close}
					disabled={isDeleting}
					class="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink
						transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!canDelete}
					class="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm
						font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed
						disabled:opacity-50"
				>
					{#if isDeleting}
						<Loader2 size={15} class="animate-spin" />
						Deleting...
					{:else}
						Delete permanently
					{/if}
				</button>
			</div>
		</form>
	</div>
{/if}
