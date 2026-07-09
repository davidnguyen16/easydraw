/**
 * Allowed key designations for an entity field.
 *
 * A field can have at most one designation at a time (single-select). Use
 * `undefined` for the "Not set / None" state.
 */
export type FieldKey = 'PK' | 'FK' | 'PI' | 'WPI';

/** Display metadata for each key type — drives badge text + dropdown long names. */
export const FIELD_KEY_INFO: Record<FieldKey, { short: string; long: string }> = {
	PK: { short: 'PK', long: 'Primary Key' },
	FK: { short: 'FK', long: 'Foreign Key' },
	PI: { short: 'PI', long: 'Primary Identifier' },
	WPI: { short: 'WPI', long: 'Weak Primary Identifier' }
};

/** Render order for the key dropdown. */
export const FIELD_KEY_ORDER: FieldKey[] = ['PK', 'FK', 'PI', 'WPI'];

export interface EntityField {
	name: string;
	/** Free-text data type. Use ENTITY_FIELD_TYPES for the suggested presets. */
	type?: string;
	/** Single-select key designation. Absent / undefined means "None". */
	key?: FieldKey;
}

/** Legacy shape — older saves used two booleans instead of a single enum. */
interface LegacyEntityField extends EntityField {
	isPK?: boolean;
	isFK?: boolean;
}

/**
 * Resolves a field's effective key, falling back to the pre-enum
 * `isPK`/`isFK` booleans for diagrams saved before the single-select model.
 * PK wins over FK when both legacy flags were set.
 */
export function resolveFieldKey(field: EntityField): FieldKey | undefined {
	if (field.key) return field.key;
	const legacy = field as LegacyEntityField;
	if (legacy.isPK) return 'PK';
	if (legacy.isFK) return 'FK';
	return undefined;
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

	/**
	 * When true, FieldsPanel reveals a type dropdown under each field, AND
	 * the entity card on the canvas shows each field's type. Conceptual /
	 * physical mode toggle — off by default to keep the conceptual view
	 * clean.
	 */
	showDataTypes?: boolean;

	// Style overrides written by StylePanel. All optional — when unset, the
	// entity falls back to its built-in design (dark red header, etc.).
	// Note: fillColor only re-colors the header, never the card body.
	fillColor?: string;
	borderColor?: string;
	borderWidth?: number;
	rounded?: boolean;
	shadow?: boolean;
	opacity?: number;
	rotation?: number;
	textColor?: string;
	fontFamily?: string;
	fontSize?: number;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	textAlign?: 'left' | 'center' | 'right';

	/**
	 * Weak entities share the full Entity editor/rendering stack, with only the
	 * ERD visual convention changed: a second inner border around the card.
	 */
	weak?: boolean;

	/**
	 * Drag-dropped nodes are wired with this shim in Flow.svelte so the
	 * canvas's outer `nodes` state mutates through a single path. New
	 * surfaces (e.g. StylePanel) call updateNodeData directly.
	 */
	onEdit?: (patch: Partial<EntityData>) => void;
}
