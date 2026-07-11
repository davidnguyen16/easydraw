<script lang="ts">
	import { ICON_PATHS } from './icon-paths';

	/**
	 * Shared stroke-icon shell for menubar / toolbar icons. Inner markup comes
	 * from the ICON_PATHS registry (static, trusted strings — safe for @html).
	 * Size via `class` (or the parent's `[&_svg]:size-*` rule when omitted).
	 */
	let {
		name,
		strokeWidth = 1.7,
		class: cls
	}: { name: string; strokeWidth?: number; class?: string } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	class={cls}
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{@html ICON_PATHS[name] ?? ''}
</svg>
