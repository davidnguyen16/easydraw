/** Copy data descriptors before reading untrusted input. Callers catch proxy traps. */
export function jsonRecord(input: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const prototype: unknown = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))) return null;
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return null;
    result[key] = descriptor.value as unknown;
  }
  return result;
}

/** Reject oversized arrays before inspecting their keys or items. */
export function jsonArray(input: unknown, maximum: number): unknown[] | null {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return null;
  const length: unknown = Object.getOwnPropertyDescriptor(input, 'length')?.value;
  if (typeof length !== 'number' || !Number.isInteger(length) || length < 0 || length > maximum) return null;
  if (Reflect.ownKeys(input).length !== length + 1) return null;
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return null;
    result.push(descriptor.value as unknown);
  }
  return result;
}

export function finiteRange(input: unknown, minimum: number, maximum: number): input is number {
  return typeof input === 'number' && Number.isFinite(input) && input >= minimum && input <= maximum;
}

export function hexColor(input: unknown): input is string {
  return typeof input === 'string' && /^#[A-Fa-f0-9]{6}$/.test(input);
}
