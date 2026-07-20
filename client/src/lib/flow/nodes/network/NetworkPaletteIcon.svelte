<script lang="ts">
	import NetworkGlyph from './NetworkGlyph.svelte';

	let { id }: { id: string } = $props();
</script>

<NetworkGlyph
	{id}
	mode="palette"
	fillColor="#ffffff"
	strokeColor="currentColor"
	accentColor="currentColor"
	strokeScale={0.9}
	class="h-8 w-9 overflow-visible"
/>
