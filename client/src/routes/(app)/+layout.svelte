<script lang="ts">
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.store.svelte';

	let { children } = $props();

	$effect(() => {
		// Route guard for authenticated pages (dashboard, editor).
		if (authStore.ready && !authStore.isAuthenticated) {
			goto('/login');
		}
	});
</script>

{#if authStore.ready && authStore.isAuthenticated}
	{@render children()}
{:else}
	<div class="flex min-h-screen items-center justify-center bg-panel text-ink-muted">
		Loading...
	</div>
{/if}

