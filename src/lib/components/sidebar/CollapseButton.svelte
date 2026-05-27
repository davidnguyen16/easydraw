<script lang="ts">
    import { 
        persistSidebarState,
        sidebarState,
        toggleCollapse
    } from '$lib/stores/sidebar.store.svelte';

   // Toggles the sidebar's collapsed state and persists it.
    function handleClick() {
        toggleCollapse();
        persistSidebarState();
    }
</script>

<button 
    type="button"
    class="collapse-button"
    class:collapsed={sidebarState.isCollapsed}
    aria-label = {sidebarState.isCollapsed ? 'Open sidebar' : 'Close sidebar'}
    aria-expanded = {!sidebarState.isCollapsed}
    onclick = {handleClick}
>
    {sidebarState.isCollapsed ? '»' : '«'}
</button>

<style>
    .collapse-button {
        position: absolute;
        top: 12px;
        right: 8px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 1px solid #D6D2C4;
        background: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);

        font-size: 1rem;
        line-height: 1;
        color: #373A36;
        cursor: pointer;

        display: flex;
        align-items: center;
        justify-content: center;

        z-index: 20;
        transition: transform 0.15s ease, background 0.15 ease;
    }

    .collapse-button:hover {
        background: #EDEBE5;
        transform: scale(1.0);
    }

    .collapse-button.collapsed {
        right: -32px;
    }
</style>