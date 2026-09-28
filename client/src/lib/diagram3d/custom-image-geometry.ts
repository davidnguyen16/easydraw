/** Fit the artwork into its editable node bounds without cropping or stretching. */
export function containImageSize(width: number, depth: number, intrinsicWidth: unknown, intrinsicHeight: unknown): [number, number] {
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  if (!valid(intrinsicWidth) || !valid(intrinsicHeight)) return [width, depth];
  const ratio = intrinsicWidth / intrinsicHeight;
  return width / depth > ratio ? [depth * ratio, depth] : [width, width / ratio];
}
