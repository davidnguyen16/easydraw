<script lang="ts">
	import { EdgeLabel } from '@xyflow/svelte';
	import type { ConnectionLabel, Point } from './types';
	import type { ConnectionLabelEditor } from './connection-label-editor.svelte';

	interface Props {
		labels: ConnectionLabel[];
		selected?: boolean;
		labelStyle: string;
		pointAtT: (t: number) => Point;
		editor: ConnectionLabelEditor;
	}

	let { labels, selected = false, labelStyle, pointAtT, editor }: Props = $props();

	function editOnDblclick(node: Element, labelId: string) {
		return editor.attachEditOnDblclick(node, labelId);
	}

	function initEditor(node: HTMLElement) {
		return editor.initEditor(node);
	}
</script>

{#each labels as label (label.id)}
	{#if label.id !== editor.editingId}
		{@const point = pointAtT(label.t)}
		<EdgeLabel x={point.x} y={point.y} transparent class="conn-label-host">
			<div
				class="nodrag nopan cursor-text rounded-[2px] px-1.5 py-0.5 text-[13px] font-semibold
					leading-[1.25] whitespace-nowrap text-[#1f1d1a] select-none
					{selected ? 'bg-[#b3d4f5]' : 'bg-white'}"
				role="button"
				tabindex="-1"
				aria-label="Connection label, double-click to edit"
				use:editOnDblclick={label.id}
				onpointerdown={(event) => event.stopPropagation()}
				style={labelStyle}
			>
				{label.text}
			</div>
		</EdgeLabel>
	{/if}
{/each}

{#if editor.editingId !== null}
	{@const point = pointAtT(editor.editingT)}
	<EdgeLabel x={point.x} y={point.y} transparent class="conn-label-host">
		<div
			class="nodrag nopan nowheel min-w-1.5 cursor-text rounded-[2px] bg-[#b3d4f5] px-1.5 py-0.5
				text-[13px] font-semibold leading-[1.25] whitespace-nowrap text-[#1f1d1a] outline-none
				select-text [caret-color:#1f1d1a]"
			role="textbox"
			tabindex="0"
			aria-label="Edit connection label"
			contenteditable="true"
			spellcheck="false"
			bind:this={editor.editorEl}
			use:initEditor
			oninput={(event) =>
				(editor.draft = (event.currentTarget as HTMLElement).textContent ?? '')}
			onkeydown={editor.onEditorKeydown}
			onblur={editor.onEditorBlur}
			onpointerdown={(event) => event.stopPropagation()}
			style={labelStyle}
		></div>
	</EdgeLabel>
{/if}
