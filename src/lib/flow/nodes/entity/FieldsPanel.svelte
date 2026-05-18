<script lang="ts">
    import { onMount } from 'svelte';
    import type { NodePanelProps } from '../types';
    import { ENTITY_FIELD_TYPES, type EntityData, type EntityField } from './types';

    let { node, onDataChange }: NodePanelProps = $props();

    // Pull the typed fields array from the generic node.data bag. The cast
    // is local so the rest of StylePanel stays node-shape-agnostic.
    let fields = $derived(
        ((node.data as unknown as EntityData).fields ?? []) as EntityField[]
    );

    // Only one type-dropdown can be open at a time, identified by field index.
    let openTypeIndex: number | null = $state(null);
    let rootEl: HTMLDivElement | undefined = $state();

    // Outside-click closes any open dropdown. Scoped to this editor so it
    // doesn't fight other listeners on the page.
    onMount(() => {
        const onPointer = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (rootEl && target && !rootEl.contains(target)) {
                openTypeIndex = null;
            }
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') openTypeIndex = null;
        };
        window.addEventListener('pointerdown', onPointer);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('pointerdown', onPointer);
            window.removeEventListener('keydown', onKey);
        };
    });

    function commitFields(next: EntityField[]) {
        onDataChange({ fields: next });
    }

    function patchField(index: number, patch: Partial<EntityField>) {
        commitFields(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
    }

    function removeField(index: number) {
        commitFields(fields.filter((_, i) => i !== index));
        if (openTypeIndex === index) openTypeIndex = null;
    }

    function addField() {
        commitFields([...fields, { name: 'field' }]);
    }

    function toggleType(index: number) {
        openTypeIndex = openTypeIndex === index ? null : index;
    }

    function selectType(index: number, value: string) {
        patchField(index, { type: value });
        openTypeIndex = null;
    }
</script>

<div class="field-editor" bind:this={rootEl}>
    <h3 class="group-label">FIELDS ({fields.length})</h3>

    {#each fields as field, i}
        <div class="field-card">
            <div class="card-row">
                <input
                    type="text"
                    class="name-input"
                    value={field.name}
                    placeholder="field"
                    oninput={(e) => patchField(i, { name: e.currentTarget.value })}
                    aria-label="Field name"
                />
                <button
                    type="button"
                    class="delete-btn"
                    aria-label="Remove field"
                    onclick={() => removeField(i)}
                >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                </button>
            </div>

            <div class="card-row">
                <button
                    type="button"
                    class="key-pill pk"
                    class:active={field.isPK}
                    aria-pressed={field.isPK ?? false}
                    aria-label="Toggle primary key"
                    onclick={() => patchField(i, { isPK: !field.isPK })}
                >
                    PK
                </button>
                <button
                    type="button"
                    class="key-pill fk"
                    class:active={field.isFK}
                    aria-pressed={field.isFK ?? false}
                    aria-label="Toggle foreign key"
                    onclick={() => patchField(i, { isFK: !field.isFK })}
                >
                    FK
                </button>

                <div class="type-select-wrap">
                    <button
                        type="button"
                        class="type-select"
                        class:open={openTypeIndex === i}
                        aria-haspopup="listbox"
                        aria-expanded={openTypeIndex === i}
                        onclick={() => toggleType(i)}
                    >
                        <span class="type-value">{field.type ? field.type.toUpperCase() : 'TYPE'}</span>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chevron">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {#if openTypeIndex === i}
                        <ul class="type-dropdown" role="listbox">
                            {#each ENTITY_FIELD_TYPES as option}
                                {@const isSelected = field.type === option}
                                <li>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        class="type-option"
                                        class:selected={isSelected}
                                        onclick={() => selectType(i, option)}
                                    >
                                        <span>{option.toUpperCase()}</span>
                                        {#if isSelected}
                                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                                <polyline points="5 12 10 17 19 8" />
                                            </svg>
                                        {/if}
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
            </div>
        </div>
    {/each}

    <button type="button" class="add-field-btn" onclick={addField}>
        + Add field
    </button>
</div>

<style>
    .field-editor {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .group-label {
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        font-weight: 700;
        color: #76232f;
        margin: 0;
    }

    .field-card {
        background: #ffffff;
        border: 1px solid #e5e0d5;
        border-radius: 8px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .card-row {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .name-input {
        flex: 1;
        min-width: 0;
        border: 1px solid #e5e0d5;
        border-radius: 6px;
        padding: 8px 10px;
        font-family: inherit;
        font-size: 0.9rem;
        outline: none;
        background: #ffffff;
        color: #2c2c2a;
    }

    .name-input:focus {
        border-color: #a6192e;
    }

    .delete-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        color: #b42318;
        cursor: pointer;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.12s ease;
    }

    .delete-btn:hover {
        background: #fdf2f1;
    }

    .key-pill {
        height: 30px;
        min-width: 38px;
        padding: 0 8px;
        border: 1px solid #e5e0d5;
        background: #ffffff;
        color: #888;
        border-radius: 6px;
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
        flex-shrink: 0;
    }

    .key-pill.pk.active {
        background: #fae9c8;
        color: #854f0b;
        border-color: #d8a85a;
    }

    .key-pill.fk.active {
        background: #dce9fa;
        color: #1e4380;
        border-color: #7aa6e6;
    }

    .type-select-wrap {
        position: relative;
        flex: 1;
        min-width: 0;
    }

    .type-select {
        width: 100%;
        height: 30px;
        padding: 0 10px;
        border: 1px solid #e5e0d5;
        background: #ffffff;
        color: #2c2c2a;
        border-radius: 6px;
        font-family: inherit;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        transition: border-color 0.12s ease;
    }

    .type-select.open {
        border-color: #a6192e;
        color: #76232f;
    }

    .type-value {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .chevron {
        flex-shrink: 0;
        opacity: 0.7;
    }

    .type-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        list-style: none;
        margin: 0;
        padding: 4px;
        background: #ffffff;
        border: 1px solid #e5e0d5;
        border-radius: 8px;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
        z-index: 200;
        max-height: 220px;
        overflow-y: auto;
    }

    .type-dropdown li {
        list-style: none;
    }

    .type-option {
        width: 100%;
        background: transparent;
        border: none;
        padding: 8px 10px;
        font-family: inherit;
        font-size: 0.78rem;
        font-weight: 600;
        color: #2c2c2a;
        text-align: left;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        transition: background 0.1s ease, color 0.1s ease;
    }

    .type-option:hover {
        background: #fbeef0;
        color: #76232f;
    }

    .type-option.selected {
        color: #76232f;
    }

    .add-field-btn {
        width: 100%;
        padding: 10px;
        border: 1px dashed #d5cbb6;
        background: transparent;
        color: #888;
        border-radius: 8px;
        font-family: inherit;
        font-size: 0.85rem;
        cursor: pointer;
        transition: border-color 0.12s ease, color 0.12s ease, background 0.12s ease;
    }

    .add-field-btn:hover {
        border-color: #76232f;
        color: #76232f;
        background: #fbeef0;
    }
</style>
