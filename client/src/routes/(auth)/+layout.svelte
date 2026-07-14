<script lang="ts">
	import { goto } from '$app/navigation';
	import { nanoid } from 'nanoid';
	import Logo from '$lib/components/Logo.svelte';

	let { children } = $props();

	const openEditor = () => goto(`/editor/${nanoid(10)}`);
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-panel px-4 py-12">
	<div class="w-full max-w-md">
		<button
			type="button"
			onclick={openEditor}
			class="mb-6 flex w-full cursor-pointer justify-center p-0"
			aria-label="Open EasyDraw editor"
		>
			<Logo size="lg" />
		</button>
		{@render children()}
	</div>
</div>
