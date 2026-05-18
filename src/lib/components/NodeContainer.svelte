<script lang="ts">
	import { useDnD } from '$lib/flow/DnDProvider.svelte';

	interface Shape {
		label: string;
		type: string;
		icon: string;
	}

	interface Props {
		heading: string;
		shapes: Shape[];
	}

	let { heading, shapes }: Props = $props();

	const dnd = useDnD();

	function onDragStart(event: DragEvent, nodeType: string) {
		if (!event.dataTransfer) return;
		dnd.current = nodeType;
		event.dataTransfer.effectAllowed = 'move';
	}
</script>

<section class="shape-section">
	<h3 class="section-heading">{heading}</h3>
	<div class="shape-grid">
		{#each shapes as shape}
			<button
				type="button"
				class="shape-tile"
				aria-label={shape.label}
				title={shape.label}
				draggable={true}
				ondragstart={(event) => onDragStart(event, shape.type)}
			>
				<svg
					viewBox={shape.icon === 'entity' ? '0 0 60 60' : '0 0 24 24'}
					xmlns="http://www.w3.org/2000/svg"
					class="shape-icon"
					class:shape-icon-large={shape.icon === 'entity'}
				>
					{#if shape.icon === 'rectangle'}
						<rect x="4" y="7" width="16" height="10" rx="1" fill="currentColor" />
					{:else if shape.icon === 'circle'}
						<circle cx="12" cy="12" r="6.5" fill="currentColor" />
					{:else if shape.icon === 'triangle'}
						<polygon points="12,5 20,18 4,18" fill="currentColor" />
					{:else if shape.icon === 'diamond'}
						<polygon points="12,4 20,12 12,20 4,12" fill="currentColor" />
					{:else if shape.icon === 'pill'}
						<rect x="3" y="9" width="18" height="6" rx="3" fill="currentColor" />
					{:else if shape.icon === 'pentagon'}
						<polygon points="3,8 14,8 20,12 14,16 3,16" fill="currentColor" />
					{:else if shape.icon === 'arrow-right'}
						<path d="M4 12 h13 M17 12 l-4 -4 M17 12 l-4 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
					{:else if shape.icon === 'arrow-double'}
						<path d="M5 9 h12 M17 9 l-3 -3 M17 9 l-3 3 M19 15 h-12 M7 15 l3 -3 M7 15 l3 3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
					{:else if shape.icon === 'arrow-bent'}
						<path d="M6 5 v9 h11 M17 14 l-3 -3 M17 14 l-3 3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
					{:else if shape.icon === 'dashed-rect'}
						<rect x="4" y="7" width="16" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2" />
					{:else if shape.icon === 'rounded-rect'}
						<rect x="4" y="6" width="16" height="12" rx="2" fill="rgba(166, 25, 46, 0.12)" stroke="currentColor" stroke-width="1.5" />
					{:else if shape.icon === 'grid-4'}
						<rect x="5" y="5" width="6" height="6" rx="1" fill="currentColor" />
						<rect x="13" y="5" width="6" height="6" rx="1" fill="currentColor" />
						<rect x="5" y="13" width="6" height="6" rx="1" fill="currentColor" />
						<rect x="13" y="13" width="6" height="6" rx="1" fill="currentColor" />
					{:else if shape.icon === 'entity'}
						<rect x="4" y="4" width="52" height="52" rx="3" fill="white" stroke="#A6192E" stroke-width="1.5" />
						<rect x="4" y="4" width="52" height="12" rx="3" fill="white" stroke="#A6192E" stroke-width="1.5" />
						<text x="30" y="13" text-anchor="middle" font-size="7.5" fill="#A6192E" font-weight="700" font-family="system-ui, sans-serif">Entity</text>
						<rect x="7" y="20" width="46" height="9" rx="1" fill="#f3f3f3" />
						<text x="10" y="26.5" font-size="6" fill="#666" font-family="system-ui, sans-serif">field</text>
						<rect x="7" y="32" width="46" height="9" rx="1" fill="#f3f3f3" />
						<text x="10" y="38.5" font-size="6" fill="#666" font-family="system-ui, sans-serif">field</text>
						<rect x="7" y="44" width="46" height="9" rx="1" fill="#f3f3f3" />
						<text x="10" y="50.5" font-size="6" fill="#666" font-family="system-ui, sans-serif">field</text>
					{/if}
				</svg>
			</button>
		{/each}
	</div>
</section>

<style>
    .shape-section {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .section-heading {
        font-size: 0.72rem;
        font-weight: 700;
        color: #76232F;
        letter-spacing: 0.06em;
        margin: 0;
        text-transform: uppercase;
    }

    .shape-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
    }

    .shape-tile {
        background: #ffffff;
        border: 1px solid #e8e2d3;
        border-radius: 8px;
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        color: #A6192E;
        padding: 0;
        transition: border-color 0.12s ease, box-shadow 0.12s ease;
    }

    .shape-tile:hover {
        border-color: #A6192E;
        box-shadow: 0 1px 4px rgba(166, 25, 46, 0.15);
    }

    .shape-tile:active {
        cursor: grabbing;
    }

    .shape-icon {
        width: 26px;
        height: 26px;
    }

    .shape-icon-large {
        width: 80%;
        height: 80%;
    }
</style>