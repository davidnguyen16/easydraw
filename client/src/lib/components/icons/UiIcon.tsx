import { ICON_PATHS } from './icon-paths';

/**
 * Shared stroke-icon shell for menubar / toolbar icons. Inner markup comes from
 * the ICON_PATHS registry (static, trusted strings). Port of UiIcon.svelte —
 * `{@html}` → dangerouslySetInnerHTML (safe: the paths are our own constants).
 */
export default function UiIcon({
  name,
  strokeWidth = 1.7,
  className,
}: {
  name: string;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] ?? '' }}
    />
  );
}
