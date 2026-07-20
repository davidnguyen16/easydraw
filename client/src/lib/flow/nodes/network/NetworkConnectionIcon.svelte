<script lang="ts">
	import type { NetworkConnectionKind } from './connections';

	interface Props {
		kind?: NetworkConnectionKind;
	}

	let { kind = 'ethernet' }: Props = $props();

	const isCurved = $derived(kind === 'serial-wan' || kind === 'wireless');
	const isOrthogonal = $derived(kind === 'vpn-tunnel' || kind === 'logical-dashed');
	const path = $derived(
		isCurved ? 'M3 18 C11 18 20 6 29 6' : isOrthogonal ? 'M3 18 H15 V6 H29' : 'M3 12 H29'
	);
	const stroke = $derived(
		kind === 'fiber' ||
			kind === 'wireless' ||
			kind === 'vpn-tunnel' ||
			kind === 'link-aggregation'
			? '#a6192e'
			: kind === 'logical-dashed'
				? '#7a7770'
				: '#2c2c2a'
	);
	const strokeWidth = $derived(
		kind === 'link-aggregation'
			? 3.2
			: kind === 'vpn-tunnel' || kind === 'trunk'
				? 2.5
				: kind === 'fiber'
					? 2.1
					: kind === 'wireless'
						? 1.9
						: kind === 'logical-dashed'
							? 1.35
							: 1.6
	);
	const dashArray = $derived(
		kind === 'wireless'
			? '0.8 3.2'
			: kind === 'serial-wan' || kind === 'vpn-tunnel' || kind === 'logical-dashed'
				? '5 3.5'
				: undefined
	);
</script>

<svg
	viewBox="0 0 32 24"
	xmlns="http://www.w3.org/2000/svg"
	class="size-[30px] overflow-visible"
	aria-hidden="true"
>
	<path
		d={path}
		fill="none"
		{stroke}
		stroke-width={strokeWidth}
		stroke-dasharray={dashArray}
		stroke-linecap="round"
		stroke-linejoin="round"
		vector-effect="non-scaling-stroke"
	/>

	{#if kind === 'link-aggregation'}
		<!-- Mirrors the single, editable LAG label on the canvas preset. -->
		<rect x="11" y="7.5" width="10" height="9" rx="2.5" fill="white" />
		<text
			x="16"
			y="12.25"
			fill="#a6192e"
			font-family="Inter, ui-sans-serif, system-ui, sans-serif"
			font-size="4.1"
			font-weight="700"
			text-anchor="middle"
			dominant-baseline="middle">LAG</text
		>
	{/if}
</svg>
