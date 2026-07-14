<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-panel px-4 py-12">
	<div class="w-full max-w-md">
		<div class="mb-6 flex justify-center">
			<Logo size="lg" />
		</div>
		{@render children()}
	</div>
</div>
