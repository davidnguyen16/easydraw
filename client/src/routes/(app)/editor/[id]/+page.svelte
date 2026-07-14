<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { page } from '$app/state';
	import Flow from '$lib/flow/Flow.svelte';
	import DnDProvider from '$lib/flow/DnDProvider.svelte';
	import { API_URL } from '$lib/api';
	import {
		loadEditorStateFromJSON,
		resetEditorState,
		editorMetaData
	} from '$lib/stores/editor.store.svelte';

	// Diagram id from the URL (/editor/:id).
	const diagramId = $derived(page.params.id);
	let loaded = $state(false);
	let error = $state('');

	// The editor is full-screen and must NOT scroll (unlike landing/auth/dashboard).
	// global.css locks page scroll only while <body> has the `editor-mode` class.
	onMount(() => {
		document.body.classList.add('editor-mode');
		return () => document.body.classList.remove('editor-mode');
	});

	onMount(async () => {
		const res = await fetch(`${API_URL}/diagrams/${diagramId}`, { credentials: 'include' });
		if (!res.ok) {
			error = 'Could not load this diagram.';
			return;
		}
		const diagram = await res.json();

		// data JSONB = EditorState. New diagrams have data = {} -> not a valid state -> start fresh. 
		const ok = loadEditorStateFromJSON(JSON.stringify(diagram.data));
		if (!ok) resetEditorState();

		editorMetaData.fileName = diagram.title;
		loaded = true;
	})	
</script>

{#if loaded}
	<SvelteFlowProvider>
		<DnDProvider>
			<Flow />
		</DnDProvider>
	</SvelteFlowProvider>
{:else if error}
	<div class="flex h-screen items-center justify-center text-ink-muted">{error}</div>
{:else}
	<div class="flex h-screen items-center justify-center text-ink-muted">Loading...</div>
{/if}