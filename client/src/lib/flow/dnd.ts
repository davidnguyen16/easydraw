// Shared drag source for palette → canvas drops (replaces the Svelte DnD
// context). NodeContainer parks the dragged shape id here on dragstart; the
// canvas onDrop reads it, looks it up in the registry, and creates the node.
export const dndState: { current: string | null } = { current: null };
