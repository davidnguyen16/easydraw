import { browser } from '$app/environment';

const EASYDRAW_STORAGE_PREFIX = 'easydraw.';

function clearEasyDrawKeys(storage: Storage) {
	for (let index = storage.length - 1; index >= 0; index -= 1) {
		const key = storage.key(index);
		if (key?.startsWith(EASYDRAW_STORAGE_PREFIX)) {
			storage.removeItem(key);
		}
	}
}

/**
 * Remove account-related EasyDraw data stored by this browser.
 *
 * Keep this prefix-based so future EasyDraw editor/preferences keys are also
 * covered without deleting storage that belongs to another application on the
 * same origin.
 */
export function clearEasyDrawBrowserData(): void {
	if (!browser) return;

	try {
		clearEasyDrawKeys(window.localStorage);
	} catch {
		// Storage can be unavailable in hardened/private browser contexts.
	}

	try {
		clearEasyDrawKeys(window.sessionStorage);
	} catch {
		// Storage can be unavailable in hardened/private browser contexts.
	}
}
