/**
 * Shared Tailwind class strings for the StylePanel tabs. State classes
 * (active / is-white) are still applied via class:… on the element; the
 * [&.…] variants here only bite when that class is present.
 */
export const GROUP = 'flex flex-col gap-2.5';
export const GROUP_LABEL = 'm-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon';
export const ROW = 'flex items-center justify-between gap-2';
export const ROW_LABEL = 'text-[0.85rem] text-ink-soft';

export const STEPPER =
	'inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-1 py-0.5';
export const STEPPER_BTN =
	'h-[22px] w-[22px] cursor-pointer rounded border-none bg-transparent text-base leading-none text-ink-soft hover:bg-[#edebe5]';
export const SIZE_INPUT = [
	'w-8 min-w-0 border-none bg-transparent p-0 text-center text-[0.85rem] text-ink-soft outline-none',
	'[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
].join(' ');

export const SQUARE_BTN = [
	'flex cursor-pointer items-center justify-center rounded-md border border-line bg-white py-3.5',
	'text-[0.95rem] text-ink-soft transition-colors duration-[120ms] hover:border-[#c4c1b8]',
	'[&.active]:border-mq-red [&.active]:bg-mq-pink [&.active]:text-mq-maroon'
].join(' ');

export const TOGGLE = 'relative inline-block h-5 w-9 flex-shrink-0';
export const TOGGLE_SLIDER = [
	'absolute inset-0 cursor-pointer rounded-full bg-[#c4c1b8] transition-colors duration-150',
	"before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full",
	"before:bg-white before:shadow-[0_1px_2px_rgba(0,0,0,0.15)] before:transition-transform",
	"before:duration-150 before:content-[''] peer-checked:bg-mq-red peer-checked:before:translate-x-4"
].join(' ');

export const SWATCH = [
	'aspect-square cursor-pointer rounded border border-transparent p-0',
	'transition-[transform,box-shadow] duration-100 hover:-translate-y-px',
	'[&.is-white]:border-line [&.active]:shadow-[0_0_0_2px_#76232f]'
].join(' ');

export const ACTION_BTN = [
	'cursor-pointer rounded-md border border-line bg-white p-2.5 text-[0.85rem] text-ink-soft',
	'transition-colors duration-[120ms] hover:border-mq-maroon hover:text-mq-maroon'
].join(' ');
export const ACTION_BTN_DANGER = [
	'cursor-pointer rounded-md border border-mq-red bg-white p-2.5 text-[0.85rem] text-mq-red',
	'transition-colors duration-[120ms] hover:bg-[#fdf2f1]'
].join(' ');

/** Labeled number field (Arrange X/Y/W/H): outer label + inner input. */
export const NUM_FIELD = [
	'flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-white px-2',
	'focus-within:border-mq-red'
].join(' ');
export const NUM_FIELD_LABEL = 'flex-shrink-0 text-[0.78rem] font-semibold text-mq-maroon';
export const NUM_FIELD_INPUT = [
	'min-w-0 flex-1 border-none bg-transparent py-2 text-[0.85rem] tabular-nums outline-none',
	'[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
].join(' ');
