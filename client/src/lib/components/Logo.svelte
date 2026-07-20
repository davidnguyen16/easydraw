<script lang="ts">
	type Size = 'sm' | 'md' | 'lg';

	let {
		size = 'md',
		showText = true,
		class: className = ''
	}: { size?: Size; showText?: boolean; class?: string } = $props();

	// Icon rendered at a fixed pixel box per size; wordmark scales with it.
	const icon = $derived(size === 'lg' ? 48 : size === 'sm' ? 24 : 32);
	const text = $derived(size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl');
</script>

<div class="flex items-center gap-2 {className}">
	<svg
		width={icon}
		height={icon}
		viewBox="0 0 48 48"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<rect x="4" y="4" width="40" height="40" rx="8" class="fill-mq-red" />
		<rect x="12" y="12" width="12" height="8" rx="2" class="fill-white/90" />
		<rect x="28" y="28" width="12" height="8" rx="2" class="fill-white/90" />
		<path
			d="M24 16 L28 16 L28 32"
			class="stroke-white/70"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<circle cx="24" cy="16" r="1.5" class="fill-white/70" />
		<circle cx="28" cy="32" r="1.5" class="fill-white/70" />
	</svg>
	{#if showText}
		<span class="{text} font-semibold tracking-tight">
			<span class="text-mq-red">Easy</span><span class="text-ink">Draw</span>
		</span>
	{/if}
</div>
