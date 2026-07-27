<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		number,
		title,
		children
	}: {
		id: string;
		number: number;
		title: string;
		children: Snippet;
	} = $props();
</script>

<section {id} class="scroll-mt-24 border-b border-line-soft py-8 last:border-b-0 sm:py-10">
	<div class="mb-5 flex items-start gap-3">
		<span
			class="mt-0.5 flex size-7 flex-shrink-0 items-center justify-center rounded-lg bg-mq-pink
				font-mono text-xs font-semibold text-mq-red"
		>
			{String(number).padStart(2, '0')}
		</span>
		<h2 class="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h2>
	</div>

	<div class="legal-copy pl-0 text-[15px] leading-7 text-ink-soft sm:pl-10">
		{@render children()}
	</div>
</section>

<style>
	.legal-copy :global(p + p),
	.legal-copy :global(p + ul),
	.legal-copy :global(p + ol),
	.legal-copy :global(ul + p),
	.legal-copy :global(ol + p),
	.legal-copy :global(div + p),
	.legal-copy :global(p + div) {
		margin-top: 1rem;
	}

	.legal-copy :global(ul),
	.legal-copy :global(ol) {
		padding-left: 1.25rem;
	}

	.legal-copy :global(ul) {
		list-style: disc;
	}

	.legal-copy :global(ol) {
		list-style: decimal;
	}

	.legal-copy :global(li + li) {
		margin-top: 0.5rem;
	}

	.legal-copy :global(li::marker) {
		color: #a6192e;
	}

	.legal-copy :global(a) {
		color: #a6192e;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.legal-copy :global(a:hover) {
		color: #76232f;
	}

	.legal-copy :global(strong) {
		color: #2c2c2a;
		font-weight: 600;
	}

	.legal-copy :global(h3) {
		margin-top: 1.25rem;
		margin-bottom: 0.4rem;
		color: #2c2c2a;
		font-size: 0.95rem;
		font-weight: 600;
	}
</style>
