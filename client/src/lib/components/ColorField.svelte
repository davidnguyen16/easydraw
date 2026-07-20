<script lang="ts">
	// A colour control: a native swatch picker (click the dot) PLUS an editable
	// hex text field so a value can be typed directly. Commits on Enter/blur;
	// invalid input reverts. Used by the StylePanel Fill / Border / Text rows.
	interface Props {
		value: string;
		onChange: (hex: string) => void;
		label: string;
	}

	let { value, onChange, label }: Props = $props();

	// Local draft so typing isn't clobbered by the reactive `value` each keystroke.
	let draft = $state<string | null>(null);
	const display = $derived(draft ?? value.toUpperCase());

	// Accepts "#rgb", "rgb", "#rrggbb", "rrggbb" → normalised "#RRGGBB", else null.
	function normalizeHex(input: string): string | null {
		let v = input.trim().replace(/^#/, '');
		if (/^[0-9a-fA-F]{3}$/.test(v)) {
			v = v
				.split('')
				.map((c) => c + c)
				.join('');
		}
		return /^[0-9a-fA-F]{6}$/.test(v) ? '#' + v.toUpperCase() : null;
	}

	function commit() {
		if (draft !== null) {
			const hex = normalizeHex(draft);
			if (hex) onChange(hex);
		}
		draft = null;
	}

	function onKeydown(event: KeyboardEvent) {
		const input = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			commit();
			input.blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			draft = null;
			input.blur();
		}
	}
</script>

<div class="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1">
	<label class="relative inline-flex cursor-pointer" aria-label="{label} colour picker">
		<span class="size-3.5 rounded-[3px] border border-line" style="background-color: {value}"></span>
		<input
			type="color"
			{value}
			oninput={(e) => onChange(e.currentTarget.value.toUpperCase())}
			class="absolute inset-0 cursor-pointer border-none p-0 opacity-0"
			aria-label="{label} colour"
		/>
	</label>
	<input
		type="text"
		maxlength="7"
		spellcheck="false"
		class="w-16 border-none bg-transparent p-0 text-[0.78rem] text-ink-soft uppercase tabular-nums
			outline-none"
		value={display}
		oninput={(e) => (draft = e.currentTarget.value)}
		onfocus={(e) => {
			draft = value.toUpperCase();
			e.currentTarget.select();
		}}
		onblur={commit}
		onkeydown={onKeydown}
		aria-label="{label} hex value"
	/>
</div>
