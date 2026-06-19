<script>
	import { SvelteFlowProvider } from '@xyflow/svelte';

	import Flow from '$lib/flow/Flow.svelte';
	import DnDProvider from '$lib/flow/DnDProvider.svelte';
</script>

<SvelteFlowProvider>
	<DnDProvider>
		<Flow />
	</DnDProvider>
	<footer></footer>
</SvelteFlowProvider>
