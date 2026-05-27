<script lang="ts">
    import {
        Handle,
        Position,
        NodeResizer,
        useSvelteFlow,
        type NodeProps
    } from '@xyflow/svelte';
    import { resolveFieldKey, type EntityData } from './types';

    let { id, data, selected }: NodeProps = $props();
    let entity = $derived(data as unknown as EntityData);

    const { updateNodeData } = useSvelteFlow();

    function commit(patch: Partial<EntityData>) {
        if (entity.onEdit) entity.onEdit(patch);
        else updateNodeData(id, patch);
    }

    function setLabel(value: string) {
        commit({ label: value });
    }

    function setFieldName(index: number, value: string) {
        commit({
            fields: entity.fields.map((field, i) =>
                i === index ? { ...field, name: value } : field
            )
        });
    }

    // Style overrides from StylePanel. Anything left undefined keeps the
    // entity's built-in defaults (white card, dark red header, etc.).
    // fillColor is intentionally scoped to the header only.
    const cardStyle = $derived(
        [
            entity.borderColor ? `border-color: ${entity.borderColor}` : '',
            entity.borderWidth !== undefined ? `border-width: ${entity.borderWidth}px` : '',
            entity.rounded !== undefined
                ? `border-radius: ${entity.rounded ? '4px' : '0'}`
                : '',
            entity.shadow ? 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)' : ''
        ]
            .filter(Boolean)
            .join('; ')
    );

    const headerStyle = $derived(
        entity.fillColor ? `background-color: ${entity.fillColor}` : ''
    );

    const titleStyle = $derived(
        [
            entity.textColor ? `color: ${entity.textColor}` : '',
            entity.fontSize ? `font-size: ${entity.fontSize}px` : '',
            entity.bold !== undefined ? `font-weight: ${entity.bold ? '700' : '500'}` : '',
            entity.italic ? 'font-style: italic' : '',
            entity.underline ? 'text-decoration: underline' : '',
            entity.textAlign ? `text-align: ${entity.textAlign}` : ''
        ]
            .filter(Boolean)
            .join('; ')
    );

    // Field name text follows the same color choice for visual consistency.
    const fieldNameStyle = $derived(
        entity.textColor ? `color: ${entity.textColor}` : ''
    );
</script>

<div class="entity-node" class:active={selected} style={cardStyle}>
    <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={80}
        handleClass="entity-resize-anchor"
        lineClass="entity-resize-line"
    />

    <Handle type="source" position={Position.Top} id="top" class="entity-handle" />
    <Handle type="source" position={Position.Right} id="right" class="entity-handle" />
    <Handle type="source" position={Position.Bottom} id="bottom" class="entity-handle" />
    <Handle type="source" position={Position.Left} id="left" class="entity-handle" />

    <header class="entity-header" style={headerStyle}>
        <input
            class="entity-title nodrag"
            type="text"
            value={entity.label ?? ''}
            placeholder="Entity"
            spellcheck="false"
            oninput={(event) => setLabel(event.currentTarget.value)}
            style={titleStyle}
        />
    </header>

    <ul class="entity-fields">
        {#each entity.fields as field, index}
            {@const key = resolveFieldKey(field)}
            <li class="entity-field" class:pk-row={key === 'PK'}>
                <span class="badge-cell">
                    {#if key}
                        <span class="badge" data-key={key}>{key}</span>
                    {/if}
                </span>
                <input
                    class="field-name nodrag"
                    type="text"
                    value={field.name}
                    placeholder="field"
                    spellcheck="false"
                    oninput={(event) => setFieldName(index, event.currentTarget.value)}
                    style={fieldNameStyle}
                />
                <!-- Field type rendering is gated by the panel's master
                     toggle — "physical" mode shows it, "conceptual" hides
                     it even if a type was previously set. -->
                {#if entity.showDataTypes && field.type}
                    <span class="field-type">{field.type.toUpperCase()}</span>
                {/if}
            </li>
        {/each}
    </ul>
</div>

<style>
    .entity-node {
        min-width: 180px;
        width: 100%;
        height: 100%;
        background: #ffffff;
        border: 1px solid #373A36;
        border-radius: 4px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
        display: flex;
        flex-direction: column;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        overflow: hidden;
        transition: box-shadow 0.15s ease;
    }

    .entity-node:hover,
    .entity-node.active {
        box-shadow: 0 4px 12px rgba(166, 25, 46, 0.15);
    }

    .entity-header {
        background: #76232f;
        padding: 8px 12px;
        border-bottom: 1px solid #373A36;
        text-align: center;
    }

    .entity-title {
        width: 100%;
        background: transparent;
        border: none;
        outline: none;
        color: #ffffff;
        font-weight: 500;
        font-size: 13px;
        text-align: center;
        padding: 0;
        font-family: inherit;
    }

    .entity-title::placeholder {
        color: rgba(255, 255, 255, 0.65);
    }

    .entity-fields {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
    }

    .entity-field {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        border-top: 0.5px solid #D6D2C4;
    }

    .entity-field:first-child {
        border-top: 1px solid #373A36;
    }

    .badge-cell {
        min-width: 36px;
        margin-right: 8px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
    }

    .badge {
        padding: 1px 5px;
        border-radius: 2px;
        font-size: 10px;
        font-weight: 600;
        line-height: 1.4;
        font-family: inherit;
    }

    /* Per-key colours mirror the FieldsPanel palette so the badge on the
       canvas matches the dropdown selection 1:1. */
    .badge[data-key='PK'] {
        background: #fae9c8;
        color: #854f0b;
    }
    .badge[data-key='FK'] {
        background: #dce9fa;
        color: #1e4380;
    }
    .badge[data-key='PI'] {
        background: #c8eae0;
        color: #0b6354;
    }
    .badge[data-key='WPI'] {
        background: #e3d8fa;
        color: #5a3fb0;
    }

    .field-name {
        flex: 1;
        min-width: 0;
        background: transparent;
        border: none;
        outline: none;
        color: #373A36;
        font-size: 12px;
        font-family: inherit;
        padding: 0;
    }

    .pk-row .field-name {
        font-weight: 500;
    }

    .field-type {
        margin-left: 8px;
        font-size: 11px;
        color: #888;
        font-family: inherit;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        flex-shrink: 0;
        text-align: right;
    }

    /* Cardinal connection handles — invisible until hover/select. */
    :global(.entity-handle) {
        width: 12px;
        height: 12px;
        background: #ffffff;
        border: 1.5px solid #a6192e;
        border-radius: 50%;
        opacity: 0;
        transition: opacity 0.12s ease;
    }

    .entity-node:hover :global(.entity-handle),
    .entity-node.active :global(.entity-handle) {
        opacity: 1;
    }

    /* NodeResizer corner anchors. */
    :global(.entity-resize-anchor) {
        width: 8px;
        height: 8px;
        background: #ffffff;
        border: 1.5px solid #A6192E;
        border-radius: 1px;
    }

    /* Hide the edge-line resize handles; spec calls for corner anchors only. */
    :global(.entity-resize-line) {
        border-color: transparent;
        background: transparent;
    }
</style>
