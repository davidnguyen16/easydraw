/**
 * Font families offered by the editor (toolbar dropdown + style panel).
 *
 * Single source of truth: each entry must have a matching `@font-face` in
 * `src/app/globals.css` and a `.woff2` file in `public/fonts/` (see the README
 * there). Inter is the default applied app-wide, via the `body` rule in
 * `globals.css`.
 */
export const FONT_FAMILIES = [
	'Bergamo Std',
	'Cousine',
	'Dustismo',
	'Gentium Basic',
	'Inter',
	'Kirsty',
	'Komika Hand',
	'Liberation Mono',
	'Liberation Sans',
	'Liberation Serif',
	'Orbitron',
	'SF Arch Rival',
	'SF Cartoonist Hand'
] as const;

export const DEFAULT_FONT_FAMILY = 'Inter';
