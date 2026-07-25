<script lang="ts">
	import { Database, GitBranch, Boxes, Waypoints } from '@lucide/svelte';

	const types = [
		{
			icon: Database,
			title: 'ERD',
			desc: 'Entity-relationship diagrams with attributes, keys, and cardinalities built in.'
		},
		{
			icon: GitBranch,
			title: 'Flowchart',
			desc: 'Map processes with decision, process, and terminator shapes plus smart connectors.'
		},
		{
			icon: Boxes,
			title: 'UML',
			desc: 'Sketch class structures and relationships using flexible shapes and labels.'
		},
		{
			icon: Waypoints,
			title: 'Data Flow Diagram',
			desc: 'Show how data moves through your system with adaptable shapes and connections.'
		}
	];
</script>

<section id="diagram-types" class="border-t border-line-soft">
	<div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
		<div class="mb-12 text-center">
			<h2 class="text-3xl font-bold text-ink sm:text-4xl">One Canvas, Many Diagrams</h2>
			<p class="mx-auto mt-4 max-w-2xl text-ink-muted">
				ERD and Flowcharts, with flexible shapes for UML and data-flow diagrams.
			</p>
		</div>
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
			{#each types as t (t.title)}
				{@const Icon = t.icon}
				<div
					class="rounded-xl border border-line-soft bg-white p-6 transition-colors
						hover:border-mq-red/40"
				>
					<div
						class="mb-4 flex size-11 items-center justify-center rounded-lg bg-mq-red/10 text-mq-red"
					>
						<Icon size={20} />
					</div>
					<h3 class="font-semibold text-ink">{t.title}</h3>
					<p class="mt-2 text-sm leading-relaxed text-ink-muted">{t.desc}</p>
				</div>
			{/each}
		</div>
	</div>
</section>
