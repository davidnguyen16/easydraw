type TextStyleField = 'bold' | 'italic' | 'underline';

export interface EditorKeyboardHandlers {
	save: () => void;
	saveAs: () => void;
	undo: () => void;
	redo: () => void;
	duplicate: () => void;
	selectAll: () => void;
	copy: () => void;
	cut: () => void;
	paste: () => void;
	deleteSelected: () => void;
	bringToFront: () => void;
	sendToBack: () => void;
	group: () => void;
	ungroup: () => void;
	fitView: () => void;
	zoomIn: () => void;
	zoomOut: () => void;
	toggleTextStyle: (field: TextStyleField) => void;
	hasSelection: () => boolean;
	hasStyleSelection: () => boolean;
}

function isInputTarget(target: HTMLElement) {
	return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

export function createEditorKeyboardHandler(handlers: EditorKeyboardHandlers) {
	return (event: KeyboardEvent) => {
		const target = event.target as HTMLElement;
		const isInInput = isInputTarget(target);
		const meta = event.ctrlKey || event.metaKey;
		const key = event.key.toLowerCase();

		if (meta && key === 's') {
			event.preventDefault();
			if (event.shiftKey) handlers.saveAs();
			else handlers.save();
			return;
		}

		if (meta && key === 'z') {
			if (isInInput) return;
			event.preventDefault();
			if (event.shiftKey) handlers.redo();
			else handlers.undo();
			return;
		}

		if (meta && key === 'y') {
			if (isInInput) return;
			event.preventDefault();
			handlers.redo();
			return;
		}

		if (meta && key === 'd') {
			if (isInInput) return;
			event.preventDefault();
			handlers.duplicate();
			return;
		}

		if (meta && key === 'a') {
			if (isInInput) return;
			event.preventDefault();
			handlers.selectAll();
			return;
		}

		if (meta && key === 'c') {
			if (isInInput) return;
			event.preventDefault();
			handlers.copy();
			return;
		}

		if (meta && key === 'x') {
			if (isInInput) return;
			event.preventDefault();
			handlers.cut();
			return;
		}

		if (meta && key === 'v') {
			if (isInInput) return;
			event.preventDefault();
			handlers.paste();
			return;
		}

		if (meta && !event.shiftKey && (key === 'b' || key === 'i' || key === 'u')) {
			if (isInInput || !handlers.hasStyleSelection()) return;
			event.preventDefault();
			handlers.toggleTextStyle(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline');
			return;
		}

		if (meta && event.shiftKey && key === 'f') {
			event.preventDefault();
			handlers.bringToFront();
			return;
		}

		if (meta && event.shiftKey && key === 'b') {
			event.preventDefault();
			handlers.sendToBack();
			return;
		}

		if (meta && event.shiftKey && key === 'g') {
			if (isInInput) return;
			event.preventDefault();
			handlers.ungroup();
			return;
		}

		if (meta && key === 'g') {
			if (isInInput) return;
			event.preventDefault();
			handlers.group();
			return;
		}

		if (meta && event.shiftKey && key === 'h') {
			event.preventDefault();
			handlers.fitView();
			return;
		}

		if (meta && (key === '=' || key === '+')) {
			event.preventDefault();
			handlers.zoomIn();
			return;
		}

		if (meta && key === '-') {
			event.preventDefault();
			handlers.zoomOut();
			return;
		}

		if (event.key === 'Delete' || event.key === 'Backspace') {
			if (isInInput || !handlers.hasSelection()) return;
			event.preventDefault();
			handlers.deleteSelected();
		}
	};
}
