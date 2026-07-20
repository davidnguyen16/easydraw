<!--
	Weak Entity preview — mirrors the real node: an Entity card wrapped in the
	ERD double-border (a continuous inner ring, evenly inset, running through
	the header band exactly like component.svelte's weak inner border).
-->
<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" class="size-[80%]">
	<!-- Outer card border -->
	<rect x="3.5" y="3.5" width="53" height="53" rx="3" fill="white" stroke="#A6192E" stroke-width="1.5" />
	<!-- Weak double border: unbroken inner ring with an even gap -->
	<rect x="7" y="7" width="46" height="46" rx="2" fill="none" stroke="#A6192E" stroke-width="1.2" />
	<!-- Header divider + title (inside the ring, like the real card) -->
	<line x1="7" y1="17.5" x2="53" y2="17.5" stroke="#A6192E" stroke-width="1.2" />
	<text
		x="30"
		y="14.5"
		text-anchor="middle"
		font-size="6"
		fill="#A6192E"
		font-weight="700"
		font-family="system-ui, sans-serif">Weak Entity</text
	>
	<!-- Field rows (no micro-text — unreadable at tile size, reads as noise) -->
	<rect x="10.5" y="21.5" width="39" height="7.5" rx="1" fill="#f3f3f3" />
	<rect x="10.5" y="32.5" width="39" height="7.5" rx="1" fill="#f3f3f3" />
	<rect x="10.5" y="43.5" width="39" height="7.5" rx="1" fill="#f3f3f3" />
</svg>
