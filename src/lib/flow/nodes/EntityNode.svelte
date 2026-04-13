<script lang="ts">
    import { Handle, Position } from '@xyflow/svelte';
    import { getContext } from 'svelte';

    let { data, selected } = $props();

    const updateNode = getContext<(id: string, data: any) => void>('updateNode');
</script>

<div class="erd-table" class:selected-node={selected}>
    <div class="header" style="background: {data.color || '#cbcaca'}">
        <input 
            type="text"
            bind:value={data.label}
            class="header-input"
            oninput={(e) => data.onEdit?.({ label: e.currentTarget.value })}
        />
    </div>
    <div class="rows">
        {#each data.fields as field, i}
            <div class="row">
                <Handle type="target" position={Position.Left} id="target-{i}-target" />

                <input
                    type="text"
                    bind:value={field.name}
                    class="field-input name"
                    oninput={(e) => {
                        const updated = data.fields.map((f: any, idx: number) =>
                            idx === i ? { ...f, name: e.currentTarget.value } : f
                        );
                        data.onEdit?.({ fields: updated });
                    }}
                />

                <input
                    type="text"
                    bind:value={field.type}
                    class="field-input type"
                    oninput={(e) => {
                        const updated = data.fields.map((f: any, idx: number) =>
                            idx === i ? { ...f, name: e.currentTarget.value } : f
                        );
                        data.onEdit?.({ fields: updated });
                    }}
                />

                <Handle type="source" position={Position.Right} id="source-{i}-source" />
            </div>
        {/each}
    </div>
</div>

<style>
    .erd-table {
        min-width: 180px;
        background: white;
        border: 1px solid #1a192b;
        border-radius: 4px;
        overflow: visible;
        font-family: 'Inter', sans-serif, system-ui;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .header {
        padding:2px;
        color: black;
        font-size: 12px;
        font-weight: 700;
        text-align: left;
        border-bottom: 1px solid #1a192b;
        border-top-left-radius: 3px;
        border-top-right-radius: 3px;
    }

    .header-input {
        width: 100%;
        background: transparent;
        border: none;
        color: black;
        font-weight: bold;
        font-size: 12px;
        padding: 4px 8px;
        outline: none;
    }

    .row {
        display: flex;
        position: relative;
        padding: 3px 6px;
        border-bottom: 1px solid #eee;
        font-size: 12px;
    }

    .row:last-child {
        border-bottom: none;
    }

    .field-input {
        border: none;
        padding: 3px 4px;
        font-size: 10px;
        outline: none;
        width: 50%;
    }

    .field-input.type {
        border-left: 1px solid #eee;
        color: #666;
    }
</style>