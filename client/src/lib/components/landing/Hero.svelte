<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import { authStore } from '$lib/stores/auth.store.svelte';
	import HeroPreview from './HeroPreview.svelte';

	const isLoading = $derived(!authStore.ready);
</script>

<section class="relative overflow-hidden">
	<div class="mx-auto max-w-6xl px-4 pt-10 pb-8 text-center sm:px-6 sm:pt-14 sm:pb-10">
		<div
			class="mb-4 inline-flex items-center gap-2 rounded-full bg-mq-red/10 px-3 py-1 text-xs
				font-medium text-mq-red"
		>
			<span class="size-1.5 rounded-full bg-mq-red"></span>
			Free to use
		</div>
		<!-- 900px cap keeps the headline on ONE line at text-5xl on desktop;
		     tablet/mobile wrap naturally at the narrower viewport. -->
		<h1
			class="mx-auto max-w-[900px] text-4xl leading-tight font-bold tracking-tight text-ink
				sm:text-5xl"
		>
			Design technical diagrams with ease
		</h1>
		<p class="mx-auto mt-3 max-w-2xl text-lg text-ink-muted">
			ERDs and flowcharts in a clean, intuitive canvas — with flexible shapes for UML and data-flow
			diagrams.
		</p>
		<div class="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
			{#if isLoading}
				<div class="h-12 w-48 animate-pulse rounded-lg bg-surface-hover"></div>
			{:else if authStore.isAuthenticated}
				<a
					href="/dashboard"
					class="flex h-12 items-center gap-2 rounded-lg bg-mq-red px-6 font-medium text-white
						transition-colors hover:bg-mq-red-hover"
				>
					Open dashboard <ArrowRight size={16} />
				</a>
			{:else}
				<a
					href="/register"
					class="flex h-12 items-center gap-2 rounded-lg bg-mq-red px-6 font-medium text-white
						transition-colors hover:bg-mq-red-hover"
				>
					Start drawing free <ArrowRight size={16} />
				</a>
				<a
					href="#how-it-works"
					class="flex h-12 items-center rounded-lg border border-line px-6 font-medium text-ink
						transition-colors hover:bg-surface-hover"
				>
					See how it works
				</a>
			{/if}
		</div>
	</div>
	<HeroPreview />
</section>
