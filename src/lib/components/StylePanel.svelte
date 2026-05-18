<script module lang="ts">
    export type TextAlign = 'left' | 'center' | 'right';

    export interface NodeStyleData {
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
        textAlign?: TextAlign;
    }
</script>

<script lang="ts">
    import type { Node } from '@xyflow/svelte';
    import { getShape } from '$lib/flow/nodes/registry';

    type StyleTab = 'style' | 'text' | 'panel' | 'arrange';

    interface Props {
        node: Node;
        /**
         * Generic data patcher. Receives a Partial<NodeStyleData> for the
         * Style/Text tabs and a Partial<NodeData> for shape-specific panels.
         * Flow merges the patch into node.data either way.
         */
        onStyleChange: (patch: Partial<NodeStyleData> & Record<string, unknown>) => void;
        onPositionChange: (x: number, y: number) => void;
        onSizeChange: (width: number, height: number) => void;
        onBringToFront: () => void;
        onSendToBack: () => void;
        onDuplicate: () => void;
        onDelete: () => void;
    }

    let {
        node,
        onStyleChange,
        onPositionChange,
        onSizeChange,
        onBringToFront,
        onSendToBack,
        onDuplicate,
        onDelete
    }: Props = $props();

    let activeTab: StyleTab = $state('style');

    // The shape registry tells us whether the selected node ships a custom
    // editor tab (e.g. EntityNode's Fields editor). No node-type-specific
    // branching here — StylePanel stays generic.
    let shape = $derived(node.type ? getShape(node.type) : undefined);
    let customPanel = $derived(shape?.panel);

    // If the user navigates to a node whose shape doesn't expose a custom
    // panel while that tab is active, fall back to Style.
    $effect(() => {
        if (!customPanel && activeTab === 'panel') {
            activeTab = 'style';
        }
    });

    const FILL_COLORS = ['#76232F', '#A6192E', '#6B4DBA', '#0E7E63', '#9C6B1A', '#FFFFFF'];
    const TEXT_COLORS = ['#2C2C2A', '#FFFFFF', '#A6192E', '#6B4DBA', '#0E7E63', '#9C6B1A'];
    const TEXT_ALIGNMENTS: TextAlign[] = ['left', 'center', 'right'];

    // The style fields live on node.data so they survive page snapshots.
    let style = $derived((node.data ?? {}) as NodeStyleData);

    let fillColor = $derived(style.fillColor ?? '#76232F');
    let borderColor = $derived(style.borderColor ?? '#2C2C2A');
    let borderWidth = $derived(style.borderWidth ?? 1);
    let rounded = $derived(style.rounded ?? true);
    let shadow = $derived(style.shadow ?? false);

    let textColor = $derived(style.textColor ?? '#2C2C2A');
    let fontSize = $derived(style.fontSize ?? 14);
    let bold = $derived(style.bold ?? false);
    let italic = $derived(style.italic ?? false);
    let underline = $derived(style.underline ?? false);
    let textAlign: TextAlign = $derived(style.textAlign ?? 'center');

    // Arrange tab pulls live values from the node, but inputs need local state
    // so we can debounce commits until blur/Enter.
    let nodeX = $derived(Math.round(node.position?.x ?? 0));
    let nodeY = $derived(Math.round(node.position?.y ?? 0));
    let nodeW = $derived(
        Math.round((node.measured?.width as number) ?? (node.width as number) ?? 0)
    );
    let nodeH = $derived(
        Math.round((node.measured?.height as number) ?? (node.height as number) ?? 0)
    );

    let xInput = $state(0);
    let yInput = $state(0);
    let wInput = $state(0);
    let hInput = $state(0);

    // Seed and re-seed inputs from the selected node's live geometry.
    $effect(() => { xInput = nodeX; });
    $effect(() => { yInput = nodeY; });
    $effect(() => { wInput = nodeW; });
    $effect(() => { hInput = nodeH; });

    function adjustBorderWidth(delta: number) {
        const next = Math.max(0, Math.min(20, borderWidth + delta));
        onStyleChange({ borderWidth: next });
    }

    function adjustFontSize(delta: number) {
        const next = Math.max(8, Math.min(96, fontSize + delta));
        onStyleChange({ fontSize: next });
    }

    function commitPosition() {
        onPositionChange(xInput, yInput);
    }

    function commitSize() {
        onSizeChange(Math.max(1, wInput), Math.max(1, hInput));
    }
</script>

<aside class="style-panel">
    <div class="tabs" role="tablist" aria-label="Node styling tabs">
        <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'style'}
            class:active={activeTab === 'style'}
            onclick={() => (activeTab = 'style')}
        >
            Style
        </button>
        <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'text'}
            class:active={activeTab === 'text'}
            onclick={() => (activeTab = 'text')}
        >
            Text
        </button>
        {#if customPanel}
            <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'panel'}
                class:active={activeTab === 'panel'}
                onclick={() => (activeTab = 'panel')}
            >
                {customPanel.label}
            </button>
        {/if}
        <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'arrange'}
            class:active={activeTab === 'arrange'}
            onclick={() => (activeTab = 'arrange')}
        >
            Arrange
        </button>
    </div>

    <div class="content">
        {#if activeTab === 'style'}
            <section class="group">
                <h3 class="group-label">FILL</h3>
                <div class="swatch-row">
                    {#each FILL_COLORS as color}
                        <button
                            type="button"
                            class="swatch"
                            class:active={fillColor.toUpperCase() === color}
                            class:is-white={color === '#FFFFFF'}
                            style="background-color: {color}"
                            aria-label="Fill {color}"
                            onclick={() => onStyleChange({ fillColor: color })}
                        ></button>
                    {/each}
                </div>
                <div class="row">
                    <span class="row-label">Custom</span>
                    <label class="color-pill">
                        <span class="color-dot" style="background-color: {fillColor}"></span>
                        <input
                            type="color"
                            value={fillColor}
                            oninput={(e) =>
                                onStyleChange({ fillColor: e.currentTarget.value.toUpperCase() })}
                            aria-label="Custom fill color"
                        />
                        <span class="color-hex">{fillColor.toUpperCase()}</span>
                    </label>
                </div>
            </section>

            <section class="group">
                <h3 class="group-label">BORDER</h3>
                <div class="row">
                    <span class="row-label">Color</span>
                    <label class="color-pill">
                        <span class="color-dot" style="background-color: {borderColor}"></span>
                        <input
                            type="color"
                            value={borderColor}
                            oninput={(e) =>
                                onStyleChange({ borderColor: e.currentTarget.value.toUpperCase() })}
                            aria-label="Border color"
                        />
                        <span class="color-hex">{borderColor.toUpperCase()}</span>
                    </label>
                </div>
                <div class="row">
                    <span class="row-label">Width</span>
                    <div class="stepper">
                        <button type="button" aria-label="Decrease width" onclick={() => adjustBorderWidth(-1)}>−</button>
                        <span class="stepper-value">{borderWidth}</span>
                        <button type="button" aria-label="Increase width" onclick={() => adjustBorderWidth(1)}>+</button>
                    </div>
                </div>
            </section>

            <section class="group">
                <h3 class="group-label">EFFECTS</h3>
                <div class="row">
                    <span class="row-label">Rounded corners</span>
                    <label class="toggle">
                        <input
                            type="checkbox"
                            checked={rounded}
                            onchange={(e) =>
                                onStyleChange({ rounded: e.currentTarget.checked })}
                        />
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="row">
                    <span class="row-label">Shadow</span>
                    <label class="toggle">
                        <input
                            type="checkbox"
                            checked={shadow}
                            onchange={(e) =>
                                onStyleChange({ shadow: e.currentTarget.checked })}
                        />
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </section>
        {:else if activeTab === 'text'}
            <section class="group">
                <h3 class="group-label">COLOR</h3>
                <div class="swatch-row">
                    {#each TEXT_COLORS as color}
                        <button
                            type="button"
                            class="swatch"
                            class:active={textColor.toUpperCase() === color}
                            class:is-white={color === '#FFFFFF'}
                            style="background-color: {color}"
                            aria-label="Text color {color}"
                            onclick={() => onStyleChange({ textColor: color })}
                        ></button>
                    {/each}
                </div>
                <div class="row">
                    <span class="row-label">Custom</span>
                    <label class="color-pill">
                        <span class="color-dot" style="background-color: {textColor}"></span>
                        <input
                            type="color"
                            value={textColor}
                            oninput={(e) =>
                                onStyleChange({ textColor: e.currentTarget.value.toUpperCase() })}
                            aria-label="Custom text color"
                        />
                        <span class="color-hex">{textColor.toUpperCase()}</span>
                    </label>
                </div>
            </section>

            <section class="group">
                <h3 class="group-label">SIZE</h3>
                <div class="stepper stepper-wide">
                    <button type="button" aria-label="Decrease font size" onclick={() => adjustFontSize(-1)}>−</button>
                    <span class="stepper-value">{fontSize}</span>
                    <button type="button" aria-label="Increase font size" onclick={() => adjustFontSize(1)}>+</button>
                </div>
            </section>

            <section class="group">
                <h3 class="group-label">STYLE</h3>
                <div class="grid-3">
                    <button
                        type="button"
                        class="square-btn"
                        class:active={bold}
                        aria-label="Bold"
                        aria-pressed={bold}
                        onclick={() => onStyleChange({ bold: !bold })}
                    >
                        <span style="font-weight: 700">B</span>
                    </button>
                    <button
                        type="button"
                        class="square-btn"
                        class:active={italic}
                        aria-label="Italic"
                        aria-pressed={italic}
                        onclick={() => onStyleChange({ italic: !italic })}
                    >
                        <span style="font-style: italic">I</span>
                    </button>
                    <button
                        type="button"
                        class="square-btn"
                        class:active={underline}
                        aria-label="Underline"
                        aria-pressed={underline}
                        onclick={() => onStyleChange({ underline: !underline })}
                    >
                        <span style="text-decoration: underline">U</span>
                    </button>
                </div>
            </section>

            <section class="group">
                <h3 class="group-label">ALIGNMENT</h3>
                <div class="grid-3">
                    {#each TEXT_ALIGNMENTS as align}
                        <button
                            type="button"
                            class="square-btn"
                            class:active={textAlign === align}
                            aria-label="Align {align}"
                            aria-pressed={textAlign === align}
                            onclick={() => onStyleChange({ textAlign: align })}
                        >
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                                {#if align === 'left'}
                                    <line x1="4" y1="7" x2="20" y2="7" />
                                    <line x1="4" y1="12" x2="14" y2="12" />
                                    <line x1="4" y1="17" x2="18" y2="17" />
                                {:else if align === 'center'}
                                    <line x1="4" y1="7" x2="20" y2="7" />
                                    <line x1="7" y1="12" x2="17" y2="12" />
                                    <line x1="5" y1="17" x2="19" y2="17" />
                                {:else}
                                    <line x1="4" y1="7" x2="20" y2="7" />
                                    <line x1="10" y1="12" x2="20" y2="12" />
                                    <line x1="6" y1="17" x2="20" y2="17" />
                                {/if}
                            </svg>
                        </button>
                    {/each}
                </div>
            </section>
        {:else if activeTab === 'panel' && customPanel}
            {@const PanelComponent = customPanel.component}
            <PanelComponent {node} onDataChange={onStyleChange} />
        {:else}
            <section class="group">
                <h3 class="group-label">POSITION</h3>
                <div class="grid-2">
                    <label class="labeled-input">
                        <span class="prefix">X</span>
                        <input
                            type="number"
                            bind:value={xInput}
                            onchange={commitPosition}
                            onblur={commitPosition}
                        />
                    </label>
                    <label class="labeled-input">
                        <span class="prefix">Y</span>
                        <input
                            type="number"
                            bind:value={yInput}
                            onchange={commitPosition}
                            onblur={commitPosition}
                        />
                    </label>
                </div>
            </section>

            <section class="group">
                <h3 class="group-label">SIZE</h3>
                <div class="grid-2">
                    <label class="labeled-input">
                        <span class="prefix">W</span>
                        <input
                            type="number"
                            bind:value={wInput}
                            onchange={commitSize}
                            onblur={commitSize}
                        />
                    </label>
                    <label class="labeled-input">
                        <span class="prefix">H</span>
                        <input
                            type="number"
                            bind:value={hInput}
                            onchange={commitSize}
                            onblur={commitSize}
                        />
                    </label>
                </div>
            </section>

            <section class="group">
                <h3 class="group-label">ORDER</h3>
                <div class="grid-2">
                    <button type="button" class="action-btn" onclick={onBringToFront}>To front</button>
                    <button type="button" class="action-btn" onclick={onSendToBack}>To back</button>
                </div>
            </section>

            <section class="group">
                <h3 class="group-label">ACTIONS</h3>
                <div class="grid-2">
                    <button type="button" class="action-btn" onclick={onDuplicate}>Duplicate</button>
                    <button type="button" class="action-btn danger" onclick={onDelete}>Delete</button>
                </div>
            </section>
        {/if}
    </div>
</aside>

<style>
    .style-panel {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 280px;
        background: #faf6ec;
        border: 1px solid #e5e0d5;
        border-radius: 12px;
        padding: 0;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
        z-index: 50;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        max-height: calc(100% - 32px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .tabs {
        display: flex;
        border-bottom: 1px solid #e5e0d5;
        flex-shrink: 0;
    }

    .tabs button {
        flex: 1;
        background: transparent;
        border: none;
        padding: 14px 0;
        font-family: inherit;
        font-size: 0.88rem;
        color: #2c2c2a;
        cursor: pointer;
        position: relative;
        transition: color 0.12s ease;
    }

    .tabs button:hover {
        color: #76232f;
    }

    .tabs button.active {
        color: #76232f;
        font-weight: 600;
    }

    .tabs button.active::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 12px;
        right: 12px;
        height: 2px;
        background: #76232f;
        border-radius: 1px;
    }

    .content {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 18px;
        overflow-y: auto;
    }

    .group {
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

    .swatch-row {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 6px;
    }

    .swatch {
        aspect-ratio: 1;
        border: 1px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        padding: 0;
        transition: transform 0.1s ease, box-shadow 0.1s ease;
    }

    .swatch.is-white {
        border-color: #e5e0d5;
    }

    .swatch.active {
        box-shadow: 0 0 0 2px #76232f;
    }

    .swatch:hover {
        transform: translateY(-1px);
    }

    .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .row-label {
        font-size: 0.85rem;
        color: #2c2c2a;
    }

    .color-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid #e5e0d5;
        cursor: pointer;
        position: relative;
    }

    .color-pill input[type='color'] {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
        border: none;
        padding: 0;
    }

    .color-dot {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        border: 1px solid #d5d0c2;
    }

    .color-hex {
        font-size: 0.78rem;
        color: #2c2c2a;
        font-variant-numeric: tabular-nums;
    }

    .stepper {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        border: 1px solid #e5e0d5;
        border-radius: 6px;
        padding: 2px 4px;
    }

    .stepper-wide {
        display: flex;
        justify-content: space-between;
        width: 100%;
        padding: 4px 10px;
    }

    .stepper-value {
        font-size: 0.85rem;
        min-width: 28px;
        text-align: center;
        font-variant-numeric: tabular-nums;
    }

    .stepper button {
        background: transparent;
        border: none;
        width: 22px;
        height: 22px;
        border-radius: 4px;
        cursor: pointer;
        color: #2c2c2a;
        font-size: 1rem;
        line-height: 1;
        font-family: inherit;
    }

    .stepper button:hover {
        background: #f3eedf;
    }

    .toggle {
        position: relative;
        width: 36px;
        height: 20px;
        display: inline-block;
        flex-shrink: 0;
    }

    .toggle input {
        opacity: 0;
        width: 0;
        height: 0;
    }

    .toggle-slider {
        position: absolute;
        inset: 0;
        background: #d0cabd;
        border-radius: 999px;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .toggle-slider::before {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        background: #ffffff;
        border-radius: 50%;
        transition: transform 0.15s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    }

    .toggle input:checked + .toggle-slider {
        background: #a6192e;
    }

    .toggle input:checked + .toggle-slider::before {
        transform: translateX(16px);
    }

    .grid-3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
    }

    .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }

    .square-btn {
        background: #ffffff;
        border: 1px solid #e5e0d5;
        border-radius: 6px;
        padding: 14px 0;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.95rem;
        color: #2c2c2a;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
    }

    .square-btn:hover {
        border-color: #d5cbb6;
    }

    .square-btn.active {
        border-color: #a6192e;
        background: #fbeef0;
        color: #76232f;
    }

    .labeled-input {
        display: flex;
        align-items: center;
        background: #ffffff;
        border: 1px solid #e5e0d5;
        border-radius: 6px;
        padding: 0 10px;
        gap: 6px;
    }

    .labeled-input:focus-within {
        border-color: #a6192e;
    }

    .labeled-input .prefix {
        font-size: 0.78rem;
        color: #76232f;
        font-weight: 600;
        flex-shrink: 0;
    }

    .labeled-input input {
        flex: 1;
        min-width: 0;
        border: none;
        outline: none;
        padding: 8px 0;
        font-size: 0.85rem;
        background: transparent;
        font-family: inherit;
        font-variant-numeric: tabular-nums;
        -moz-appearance: textfield;
        appearance: textfield;
    }

    .labeled-input input::-webkit-outer-spin-button,
    .labeled-input input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        appearance: none;
        margin: 0;
    }

    .action-btn {
        background: #ffffff;
        border: 1px solid #e5e0d5;
        border-radius: 6px;
        padding: 10px;
        font-family: inherit;
        font-size: 0.85rem;
        cursor: pointer;
        color: #2c2c2a;
        transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
    }

    .action-btn:hover {
        border-color: #76232f;
        color: #76232f;
    }

    .action-btn.danger {
        border-color: #a6192e;
        color: #a6192e;
    }

    .action-btn.danger:hover {
        background: #fdf2f1;
    }
</style>
