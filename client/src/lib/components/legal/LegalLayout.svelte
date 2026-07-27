<script lang="ts">
	import { CalendarDays, ChevronLeft, Mail } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import LandingFooter from '$lib/components/landing/LandingFooter.svelte';
	import Logo from '$lib/components/Logo.svelte';

	type SectionLink = {
		id: string;
		title: string;
	};

	let {
		title,
		description,
		lastUpdated,
		sections,
		children
	}: {
		title: string;
		description: string;
		lastUpdated: string;
		sections: SectionLink[];
		children: Snippet;
	} = $props();
</script>

<svelte:head>
	<title>{title} | EasyDraw</title>
	<meta name="description" content={description} />
</svelte:head>

<div class="flex min-h-screen flex-col bg-[#faf8f3]">
	<header class="sticky top-0 z-40 border-b border-line-soft bg-white/90 backdrop-blur-md">
		<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
			<a href="/" aria-label="EasyDraw home">
				<Logo size="md" />
			</a>

			<nav class="flex items-center gap-2" aria-label="Legal page navigation">
				<a
					href="/"
					class="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink
						transition-colors hover:bg-surface-hover sm:flex"
				>
					<ChevronLeft size={16} aria-hidden="true" />
					Home
				</a>
				<a
					href="/dashboard"
					class="flex h-9 items-center rounded-lg bg-mq-red px-3.5 text-sm font-medium text-white
						transition-colors hover:bg-mq-red-hover"
				>
					Open EasyDraw
				</a>
			</nav>
		</div>
	</header>

	<main class="flex-1">
		<section class="border-b border-line-soft bg-white">
			<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
				<div
					class="mb-5 inline-flex items-center rounded-full border border-mq-red/15 bg-mq-pink
						px-3 py-1 text-xs font-semibold tracking-wider text-mq-red uppercase"
				>
					EasyDraw legal
				</div>
				<h1 class="max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
					{title}
				</h1>
				<p class="mt-5 max-w-3xl text-base leading-7 text-ink-muted sm:text-lg">
					{description}
				</p>
				<div class="mt-6 flex items-center gap-2 text-sm text-ink-muted">
					<CalendarDays size={16} aria-hidden="true" />
					<span>Last updated: {lastUpdated}</span>
				</div>
			</div>
		</section>

		<div
			class="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12
				lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start"
		>
			<details class="rounded-xl border border-line bg-white p-4 shadow-sm lg:hidden">
				<summary class="cursor-pointer text-sm font-semibold text-ink">On this page</summary
				>
				<nav class="mt-3 grid gap-1" aria-label="Table of contents">
					{#each sections as section, index (section.id)}
						<a
							href="#{section.id}"
							class="flex gap-3 rounded-lg px-2 py-2 text-sm text-ink-muted transition-colors
								hover:bg-surface-hover hover:text-ink"
						>
							<span class="font-mono text-xs text-mq-red"
								>{String(index + 1).padStart(2, '0')}</span
							>
							<span>{section.title}</span>
						</a>
					{/each}
				</nav>
			</details>

			<aside class="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto lg:block">
				<p class="mb-3 px-3 text-xs font-semibold tracking-wider text-ink-muted uppercase">
					On this page
				</p>
				<nav class="grid gap-0.5" aria-label="Table of contents">
					{#each sections as section, index (section.id)}
						<a
							href="#{section.id}"
							class="group flex gap-3 rounded-lg px-3 py-2 text-sm text-ink-muted
								transition-colors hover:bg-white hover:text-ink"
						>
							<span class="font-mono text-xs text-mq-red/70 group-hover:text-mq-red">
								{String(index + 1).padStart(2, '0')}
							</span>
							<span>{section.title}</span>
						</a>
					{/each}
				</nav>
			</aside>

			<article
				class="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
			>
				<div class="px-5 sm:px-8 lg:px-10">
					{@render children()}
				</div>

				<div class="border-t border-line-soft bg-panel px-5 py-7 sm:px-8 lg:px-10">
					<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
						<div>
							<h2 class="text-base font-semibold text-ink">
								Questions about this page?
							</h2>
							<p class="mt-1 text-sm text-ink-muted">
								We are happy to clarify how EasyDraw works.
							</p>
						</div>
						<a
							href="mailto:support@easydraw.net"
							class="inline-flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-lg
								border border-line bg-white px-4 text-sm font-medium text-ink transition-colors
								hover:border-mq-red/30 hover:text-mq-red"
						>
							<Mail size={16} aria-hidden="true" />
							support@easydraw.net
						</a>
					</div>
				</div>
			</article>
		</div>
	</main>

	<LandingFooter />
</div>
