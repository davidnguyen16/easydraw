import type { NodePanelProps } from '@/lib/flow/nodes/types';

// TODO: port the full entity Fields editor (FieldsPanel.svelte). Stubbed for now
// — it only renders when StylePanel shows the shape's custom tab, which isn't
// wired until the registry-driven custom panel lands. Inline field editing on
// the EntityNode itself still works.
export default function FieldsPanel(_props: NodePanelProps) {
  return null;
}
