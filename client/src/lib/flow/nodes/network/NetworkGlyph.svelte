<script lang="ts">
	import { getNetworkDefinition } from './definitions';
	import { NETWORK_SYMBOLS, type NetworkPaintRole, type NetworkPrimitive } from './symbols';

	interface Props {
		id: string;
		mode?: 'canvas' | 'palette';
		fillColor?: string;
		strokeColor?: string;
		accentColor?: string;
		strokeScale?: number;
		opacity?: number;
		class?: string;
	}

	let {
		id,
		mode = 'canvas',
		fillColor = '#ffffff',
		strokeColor = '#2c2c2a',
		accentColor = '#a6192e',
		strokeScale = 1,
		opacity = 1,
		class: className = ''
	}: Props = $props();

	const definition = $derived(getNetworkDefinition(id));
	const primitives = $derived<readonly NetworkPrimitive[]>(
		definition ? NETWORK_SYMBOLS[definition.symbol] : []
	);
	const preserveAspectRatio = $derived(
		definition?.kind === 'container' && mode === 'canvas' ? 'none' : 'xMidYMid meet'
	);
	const viewBox = $derived(definition?.viewBox ?? '0 0 100 80');

	function paint(role: NetworkPaintRole | undefined): string {
		switch (role) {
			case 'none':
				return 'none';
			case 'surface':
				return fillColor;
			case 'accent':
				return accentColor;
			case 'accent-soft':
				return `color-mix(in srgb, ${accentColor} 11%, ${fillColor})`;
			case 'muted':
				return `color-mix(in srgb, ${strokeColor} 48%, ${fillColor})`;
			case 'ink':
			default:
				return strokeColor;
		}
	}

	function scaledStrokeWidth(width: number | undefined): number | undefined {
		if (width === undefined) return undefined;
		const safeScale = Number.isFinite(strokeScale)
			? Math.max(0, Math.min(10 / 1.8, strokeScale))
			: 1;
		return width * safeScale;
	}
</script>

<svg
	{viewBox}
	{preserveAspectRatio}
	class={className}
	style:opacity
	aria-hidden="true"
	focusable="false"
>
	{#each primitives as primitive}
		{#if !(mode === 'palette' && primitive.paletteHidden)}
			{@const fill = paint(primitive.fill)}
			{@const stroke = paint(primitive.stroke)}
			{@const width = scaledStrokeWidth(primitive.strokeWidth)}

			{#if primitive.kind === 'path'}
				<path
					d={primitive.d}
					{fill}
					{stroke}
					stroke-width={width}
					stroke-dasharray={primitive.dash}
					stroke-linecap={primitive.lineCap}
					stroke-linejoin={primitive.lineJoin}
					opacity={primitive.opacity}
					vector-effect="non-scaling-stroke"
				/>
			{:else if primitive.kind === 'rect'}
				<rect
					x={primitive.x}
					y={primitive.y}
					width={primitive.width}
					height={primitive.height}
					rx={primitive.rx}
					{fill}
					{stroke}
					stroke-width={width}
					stroke-dasharray={primitive.dash}
					stroke-linecap={primitive.lineCap}
					stroke-linejoin={primitive.lineJoin}
					opacity={primitive.opacity}
					vector-effect="non-scaling-stroke"
				/>
			{:else if primitive.kind === 'circle'}
				<circle
					cx={primitive.cx}
					cy={primitive.cy}
					r={primitive.r}
					{fill}
					{stroke}
					stroke-width={width}
					stroke-dasharray={primitive.dash}
					opacity={primitive.opacity}
					vector-effect="non-scaling-stroke"
				/>
			{:else if primitive.kind === 'ellipse'}
				<ellipse
					cx={primitive.cx}
					cy={primitive.cy}
					rx={primitive.rx}
					ry={primitive.ry}
					{fill}
					{stroke}
					stroke-width={width}
					stroke-dasharray={primitive.dash}
					opacity={primitive.opacity}
					vector-effect="non-scaling-stroke"
				/>
			{:else if primitive.kind === 'line'}
				<line
					x1={primitive.x1}
					y1={primitive.y1}
					x2={primitive.x2}
					y2={primitive.y2}
					{stroke}
					stroke-width={width}
					stroke-dasharray={primitive.dash}
					stroke-linecap={primitive.lineCap}
					opacity={primitive.opacity}
					vector-effect="non-scaling-stroke"
				/>
			{:else if primitive.kind === 'polyline'}
				<polyline
					points={primitive.points}
					{fill}
					{stroke}
					stroke-width={width}
					stroke-dasharray={primitive.dash}
					stroke-linecap={primitive.lineCap}
					stroke-linejoin={primitive.lineJoin}
					opacity={primitive.opacity}
					vector-effect="non-scaling-stroke"
				/>
			{:else if primitive.kind === 'polygon'}
				<polygon
					points={primitive.points}
					{fill}
					{stroke}
					stroke-width={width}
					stroke-dasharray={primitive.dash}
					stroke-linejoin={primitive.lineJoin}
					opacity={primitive.opacity}
					vector-effect="non-scaling-stroke"
				/>
			{:else}
				<text
					x={primitive.x}
					y={primitive.y}
					{fill}
					font-family="Inter, ui-sans-serif, system-ui, sans-serif"
					font-size={primitive.fontSize ?? 12}
					font-weight={primitive.fontWeight ?? 700}
					text-anchor="middle"
					dominant-baseline="middle"
					opacity={primitive.opacity}
				>
					{primitive.text}
				</text>
			{/if}
		{/if}
	{/each}
</svg>
