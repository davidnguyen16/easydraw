<script lang="ts">
	import type { Component } from 'svelte';
	import { Keyboard, X, Folder, Pencil, Type, Layers, ZoomIn, Info } from '@lucide/svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	interface ShortcutItem {
		label: string;
		combos: string[][];
	}
	interface ShortcutGroup {
		column: 0 | 1;
		title: string;
		icon: Component;
		items: ShortcutItem[];
	}

	// Mirrors the handlers wired in flow/keyboard-shortcuts.ts.
	const GROUPS: ShortcutGroup[] = [
		{
			column: 0,
			title: 'File',
			icon: Folder,
			items: [
				{ label: 'Save', combos: [['Ctrl', 'S']] },
				{ label: 'Save as', combos: [['Ctrl', 'Shift', 'S']] }
			]
		},
		{
			column: 0,
			title: 'Edit and history',
			icon: Pencil,
			items: [
				{ label: 'Undo', combos: [['Ctrl', 'Z']] },
				{
					label: 'Redo',
					combos: [
						['Ctrl', 'Shift', 'Z'],
						['Ctrl', 'Y']
					]
				},
				{ label: 'Duplicate', combos: [['Ctrl', 'D']] },
				{ label: 'Select all', combos: [['Ctrl', 'A']] },
				{ label: 'Copy', combos: [['Ctrl', 'C']] },
				{ label: 'Cut', combos: [['Ctrl', 'X']] },
				{ label: 'Paste', combos: [['Ctrl', 'V']] },
				{ label: 'Delete selection', combos: [['Del'], ['Backspace']] }
			]
		},
		{
			column: 1,
			title: 'Text format',
			icon: Type,
			items: [
				{ label: 'Bold', combos: [['Ctrl', 'B']] },
				{ label: 'Italic', combos: [['Ctrl', 'I']] },
				{ label: 'Underline', combos: [['Ctrl', 'U']] }
			]
		},
		{
			column: 1,
			title: 'Arrange',
			icon: Layers,
			items: [
				{ label: 'Bring to front', combos: [['Ctrl', 'Shift', 'F']] },
				{ label: 'Send to back', combos: [['Ctrl', 'Shift', 'B']] },
				{ label: 'Group', combos: [['Ctrl', 'G']] },
				{ label: 'Ungroup', combos: [['Ctrl', 'Shift', 'G']] }
			]
		},
		{
			column: 1,
			title: 'View',
			icon: ZoomIn,
			items: [
				{ label: 'Fit view', combos: [['Ctrl', 'Shift', 'H']] },
				{
					label: 'Zoom in',
					combos: [
						['Ctrl', '='],
						['Ctrl', '+']
					]
				},
				{ label: 'Zoom out', combos: [['Ctrl', '−']] }
			]
		}
	];

	// ⌘ on Apple platforms, Ctrl everywhere else (matches the real handler,
	// which treats ctrlKey || metaKey as the same "meta").
	const modKey =
		typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
			? '⌘'
			: 'Ctrl';

	const left = GROUPS.filter((g) => g.column === 0);
	const right = GROUPS.filter((g) => g.column === 1);

	function close() {
		open = false;
	}
</script>

<!-- Esc closes; Ctrl/⌘+/ toggles from anywhere in the editor. -->
<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape') {
			close();
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key === '/') {
			e.preventDefault();
			open = !open;
		}
	}}
/>

{#snippet kbd(label: string, tight: boolean)}
	<span
		class="inline-block whitespace-nowrap rounded border border-line border-b-[1.5px] bg-panel
			py-px font-mono text-[11px] leading-normal text-ink-soft {tight ? 'px-1' : 'px-[5px]'}"
	>
		{label}
	</span>
{/snippet}

{#snippet row(item: ShortcutItem)}
	<div class="flex items-center justify-between gap-2.5 py-1">
		<span class="whitespace-nowrap text-[12.5px] text-ink">{item.label}</span>
		<span class="flex flex-shrink-0 items-center gap-[3px]">
			{#each item.combos as combo, i}
				<span class="flex items-center gap-[3px]">
					{#if i > 0}<span class="px-px text-[10px] text-ink-muted">/</span>{/if}
					{#each combo as key}
						{@render kbd(key === 'Ctrl' ? modKey : key, false)}
					{/each}
				</span>
			{/each}
		</span>
	</div>
{/snippet}

{#snippet group(g: ShortcutGroup, isFirst: boolean)}
	{@const Icon = g.icon}
	<div>
		<div
			class="flex items-center gap-1.5 text-[10px] tracking-[0.5px] text-mq-maroon uppercase
				{isFirst ? 'mb-1' : 'mt-3.5 mb-1'}"
		>
			<Icon size={13} strokeWidth={1.75} aria-hidden="true" />
			{g.title}
		</div>
		{#each g.items as item}
			{@render row(item)}
		{/each}
	</div>
{/snippet}

{#if open}
	<div
		class="fixed inset-0 z-[1000] flex items-center justify-center p-5"
		role="dialog"
		aria-modal="true"
		aria-label="Keyboard shortcuts"
	>
		<!-- backdrop -->
		<button
			class="absolute inset-0 bg-[rgba(44,44,42,0.35)]"
			onclick={close}
			aria-label="Close"
			tabindex="-1"
		></button>

		<!-- card -->
		<div
			class="relative z-10 max-h-[calc(100vh-40px)] w-[640px] max-w-full overflow-y-auto rounded-[10px]
				bg-white shadow-[0_16px_40px_rgba(0,0,0,0.25)]"
		>
			<div class="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
				<div class="flex items-center gap-2">
					<Keyboard size={18} strokeWidth={1.75} class="text-mq-maroon" />
					<span class="text-base font-medium text-ink">Keyboard shortcuts</span>
				</div>
				<button
					type="button"
					onclick={close}
					aria-label="Close"
					class="flex rounded p-0.5 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
				>
					<X size={18} strokeWidth={1.75} />
				</button>
			</div>

			<div class="grid grid-cols-2 max-[520px]:grid-cols-1">
				<div class="border-r border-line-soft px-5 py-4 max-[520px]:border-r-0 max-[520px]:border-b">
					{#each left as g, i}
						{@render group(g, i === 0)}
					{/each}
				</div>
				<div class="px-5 py-4">
					{#each right as g, i}
						{@render group(g, i === 0)}
					{/each}
				</div>
			</div>

			<div class="flex items-center gap-1.5 border-t border-line-soft bg-panel px-5 py-2.5">
				<Info size={13} strokeWidth={1.75} class="text-ink-muted" />
				<span class="flex items-center gap-1 text-[11.5px] text-ink-muted">
					Press {@render kbd(modKey, true)} {@render kbd('/', true)} any time to open this panel
				</span>
			</div>
		</div>
	</div>
{/if}
