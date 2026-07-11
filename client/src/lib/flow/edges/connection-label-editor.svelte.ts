import { nanoid } from 'nanoid';
import type { ConnectionLabel, Point } from './types';

const MIN_LABEL_GAP_PX = 14;

type LabelUpdater = (updater: (prev: ConnectionLabel[]) => ConnectionLabel[]) => void;

interface ConnectionLabelEditorOptions {
	getLabels: () => ConnectionLabel[];
	getTotalLength: () => number;
	tAtFlowPoint: (point: Point) => number;
	screenToFlowPosition: (point: Point) => Point;
	patchLabels: LabelUpdater;
	selectEdgeForStyling: () => void;
}

export function createConnectionLabelEditor({
	getLabels,
	getTotalLength,
	tAtFlowPoint,
	screenToFlowPosition,
	patchLabels,
	selectEdgeForStyling
}: ConnectionLabelEditorOptions) {
	let editingId = $state<string | null>(null);
	let editingT = $state(0.5);
	let draft = $state('');
	let editorEl = $state<HTMLElement>();
	let cancelled = false;
	let editingWasNew = false;

	const isEditing = $derived(editingId !== null);

	function createAt(flowPoint: Point) {
		const t = tAtFlowPoint(flowPoint);
		const tooClose = getLabels().some(
			(label) => Math.abs(label.t - t) * getTotalLength() < MIN_LABEL_GAP_PX
		);
		if (tooClose) return;

		editingWasNew = true;
		editingT = t;
		draft = '';
		editingId = nanoid();
		selectEdgeForStyling();
	}

	function startEditing(labelId: string) {
		const found = getLabels().find((label) => label.id === labelId);
		if (!found) return;

		editingWasNew = false;
		editingT = found.t;
		draft = found.text;
		editingId = labelId;
		selectEdgeForStyling();
	}

	function blurIfDeselected(selected: boolean | undefined) {
		if (editingId !== null && !selected) {
			editorEl?.blur();
		}
	}

	function installClickAway() {
		if (editingId === null) return;

		const onPointerDown = (event: PointerEvent) => {
			if (event.target instanceof Node && editorEl && !editorEl.contains(event.target)) {
				editorEl.blur();
			}
		};

		window.addEventListener('pointerdown', onPointerDown, true);
		return () => window.removeEventListener('pointerdown', onPointerDown, true);
	}

	function attachCreateOnDblclick(node: Element) {
		const handler = (event: Event) => {
			event.stopPropagation();
			const mouse = event as MouseEvent;
			createAt(screenToFlowPosition({ x: mouse.clientX, y: mouse.clientY }));
		};

		node.addEventListener('dblclick', handler);
		return { destroy: () => node.removeEventListener('dblclick', handler) };
	}

	function attachEditOnDblclick(node: Element, labelId: string) {
		let current = labelId;
		const handler = (event: Event) => {
			event.stopPropagation();
			startEditing(current);
		};

		node.addEventListener('dblclick', handler);
		return {
			update: (next: string) => (current = next),
			destroy: () => node.removeEventListener('dblclick', handler)
		};
	}

	function initEditor(node: HTMLElement) {
		node.textContent = draft;
		requestAnimationFrame(() => {
			node.focus();
			const range = document.createRange();
			range.selectNodeContents(node);
			range.collapse(false);
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
		});
	}

	function onEditorKeydown(event: KeyboardEvent) {
		event.stopPropagation();
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			(event.currentTarget as HTMLElement).blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelled = true;
			(event.currentTarget as HTMLElement).blur();
		}
	}

	function commitLabel() {
		const text = draft.trim();
		const targetId = editingId;
		const wasNew = editingWasNew;
		const t = editingT;

		patchLabels((prev) => {
			if (!text) return prev.filter((label) => label.id !== targetId);
			if (wasNew) return [...prev, { id: targetId as string, t, text }];
			return prev.map((label) => (label.id === targetId ? { ...label, text } : label));
		});

		editingId = null;
	}

	function cancelLabel() {
		editingId = null;
	}

	function onEditorBlur() {
		window.getSelection()?.removeAllRanges();
		if (cancelled) {
			cancelled = false;
			cancelLabel();
		} else {
			commitLabel();
		}
	}

	return {
		get editingId() {
			return editingId;
		},
		get editingT() {
			return editingT;
		},
		get draft() {
			return draft;
		},
		set draft(value: string) {
			draft = value;
		},
		get editorEl() {
			return editorEl;
		},
		set editorEl(value: HTMLElement | undefined) {
			editorEl = value;
		},
		get isEditing() {
			return isEditing;
		},
		blurIfDeselected,
		installClickAway,
		attachCreateOnDblclick,
		attachEditOnDblclick,
		initEditor,
		onEditorKeydown,
		onEditorBlur
	};
}

export type ConnectionLabelEditor = ReturnType<typeof createConnectionLabelEditor>;
