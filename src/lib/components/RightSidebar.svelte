<script lang="ts">
    let { node, onUpdate } = $props();

    function addField() {
        const newField = { name: 'field', type: 'varchar' };
        const updatedFields = [...(node.data.fields || []), newField];
        onUpdate({ fields: updatedFields });
    }

    function removeField(index: number) {
        const updatedFields = node.data.fields.filter((_: any, i: number) => i !== index);
        onUpdate({ fields: updatedFields });
    }
</script>

<aside class="sidebar right">
    <div class="sidebar-header">
        <span class="context-label">Edit Table</span>
        <input class="table-name" bind:value={node.data.label} oninput={(e) => onUpdate({ label: e.currentTarget.value })} />
    </div>

    <div class="field-list">
        {#each node.data.fields as field, i}
            <div class="field-row">
                <input 
                    class="input-styled name-input" 
                    bind:value={field.name} 
                    oninput={(e) => {
                        const updated = node.data.fields.map((f: any, idx: number) =>
                            idx === i ? { ...f, name: e.currentTarget.value } : f
                        );
                        onUpdate({ fields: updated });
                    }} 
                />
                <select 
                    class="input-styled" 
                    bind:value={field.type} 
                    onchange={(e) => {
                        const updated = node.data.fields.map((f: any, idx: number) =>
                            idx === i ? { ...f, type: e.currentTarget.value } : f
                        );
                        onUpdate({ fields: updated });
                    }}
                >
                    <option value="PK">PK</option>
                    <option value="varchar">varchar</option>
                    <option value="int">int</option>
                    <option value="datetime">datetime</option>
                </select>
                <button class="remove-btn" onclick={() => removeField(i)}>x</button>
            </div>
        {/each}
    </div>

    <button class="add-btn" onclick={addField}>Add Field</button>
</aside>

<style>
    .sidebar {
        width: 320px;
        height: 94vh;
        position: fixed;
        top: 3vh;
        background: white;
        padding: 2rem 1.5rem;
        display: flex;
        flex-direction: column;
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        z-index: 100;
        box-sizing: border-box;
    }

    .right {
        right: 20px;
    }

    .sidebar-header {
        margin-bottom: 1.5rem;
    }

    .context-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #888;
        font-weight: 600;
    }

    .table-name {
        font-weight: bold;
        font-size: 1.4rem;
        border: none;
        outline: none;
        padding: 0;
    }

    .field-row {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
        align-items: center;
    }

    .input-styled {
        background: #f8f9fa;
        border: 1px solid #eee;
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 0.85rem;
        outline: none;
    }

    .input-styled:focus {
        border-color: #222138;
    }

    .remove-btn {
        background: none;
        border: none;
        color: #ccc;
        font-size: 1.2rem;
        cursor: pointer;
        transition: color 0.2s;
    }

    .remove-btn:hover {
        color: #ff4d4d;
    }

    .add-btn {
        margin-top: auto;
        background: #222138;
        color: white;
        border: none;
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    .add-btn:hover {
        opacity: 0.9;
    }   
</style>