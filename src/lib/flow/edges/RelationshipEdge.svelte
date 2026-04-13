<script lang="ts">
    import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/svelte';

    let {
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        data
    }: EdgeProps = $props();

    const [edgePath] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition
    });

    const relationship = (data as any)?.relationship ?? 'one-to-many';

    const sourceMarker = relationship === 'many-to-many' ? 'url(#many)' : 'url(#one)';
    const targetMarker = relationship === 'one-to-one' ? 'url(#one)' : 'url(#many)';
</script>

<BaseEdge 
    path={edgePath} 
    markerStart={sourceMarker}
    markerEnd={targetMarker}
/>
