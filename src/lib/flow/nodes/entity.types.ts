export interface EntityField {
    name: string;
    /** Free-text data type. Use ENTITY_FIELD_TYPES for the suggested presets. */
    type?: string;
    /** Primary key flag. Independent of isFK — a field can be both. */
    isPK?: boolean;
    /** Foreign key flag. Independent of isPK — a field can be both. */
    isFK?: boolean;
}

/**
 * Preset suggestions for the field-type combobox. The input is free text so
 * users can still type "varchar(10)" or "json" etc.
 */
export const ENTITY_FIELD_TYPES = [
    'int',
    'varchar(255)',
    'text',
    'boolean',
    'date',
    'timestamp',
    'decimal(10,2)',
    'float'
] as const;

export interface EntityData {
    label: string;
    fields: EntityField[];

    // Style overrides written by StylePanel. All optional — when unset, the
    // entity falls back to its built-in design (dark red header, etc.).
    // Note: fillColor only re-colors the header, never the card body.
    fillColor?: string;
    borderColor?: string;
    borderWidth?: number;
    rounded?: boolean;
    shadow?: boolean;
    textColor?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    textAlign?: 'left' | 'center' | 'right';

    /**
     * Drag-dropped nodes are wired with this shim in Flow.svelte so the
     * canvas's outer `nodes` state mutates through a single path. New
     * surfaces (e.g. StylePanel) call updateNodeData directly.
     */
    onEdit?: (patch: Partial<EntityData>) => void;
}
