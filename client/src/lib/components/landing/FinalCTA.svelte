<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import { authStore } from '$lib/stores/auth.store.svelte';

	const isLoading = $derived(!authStore.ready);
</script>

<section class="border-t border-line-soft bg-mq-red">
	<div class="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
		<h2 class="text-3xl font-bold text-white sm:text-4xl">Ready To Start Diagramming?</h2>
		<p class="mx-auto mt-4 max-w-xl text-white/80">
			EasyDraw is free to use — no payment details, no trial limits.
		</p>
		<div class="mt-8 flex justify-center">
			{#if isLoading}
				<div class="h-12 w-48 animate-pulse rounded-lg bg-white/20"></div>
			{:else}
				<a
					href={authStore.isAuthenticated ? '/dashboard' : '/register'}
					class="flex h-12 items-center gap-2 rounded-lg bg-white px-6 font-medium text-mq-red
						transition-colors hover:bg-white/90"
				>
					{authStore.isAuthenticated ? 'Open dashboard' : 'Start drawing free'}
					<ArrowRight size={16} />
				</a>
			{/if}
		</div>
	</div>
</section>
