export function toFiniteRotation(value: unknown) {
	const n = typeof value === 'number' ? value : Number(value ?? 0);
	if (!Number.isFinite(n)) return 0;
	return Math.round(n);
}

export function normalizeRotation(value: unknown) {
	const n = toFiniteRotation(value);
	return ((Math.round(n) % 360) + 360) % 360;
}

export function nearestRotationEquivalent(target: unknown, current: unknown) {
	const targetDisplay = normalizeRotation(target);
	const currentRaw = toFiniteRotation(current);
	const currentDisplay = normalizeRotation(currentRaw);
	let delta = targetDisplay - currentDisplay;

	if (delta > 180) delta -= 360;
	if (delta < -180) delta += 360;

	return currentRaw + delta;
}
