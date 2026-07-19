<script lang="ts">
	import { MousePointerClick, Spline, Layers, Palette, Cloud, Download } from '@lucide/svelte';

	const features = [
		{
			icon: MousePointerClick,
			title: 'Drag & drop shape library',
			desc: 'A rich shape library — just drag shapes onto the canvas and start building.'
		},
		{
			icon: Spline,
			title: 'Smart connectors and ERD cardinalities',
			desc: 'Orthogonal routing, labels, and one-to-many cardinalities on every connection.'
		},
		{
			icon: Layers,
			title: 'Multi-page canvas',
			desc: 'Organize complex projects across multiple pages within a single diagram.'
		},
		{
			icon: Palette,
			title: 'Node and connection styling',
			desc: 'Customize fills, borders, typography, and effects for every node and edge.'
		},
		{
			icon: Cloud,
			title: 'Auto-save and document status',
			desc: 'Changes are saved automatically while you work, with a clear save indicator.'
		},
		{
			icon: Download,
			title: 'Export and backup',
			desc: 'Export diagrams as PNG, JPEG, or PDF — or back them up as .easydraw files.'
		}
	];
</script>

<!-- half-white wash over the cream page ground (React's bg-card/50) -->
<section id="features" class="border-t border-line-soft bg-white/50">
	<div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
		<div class="mb-12 text-center">
			<h2 class="text-3xl font-bold text-ink sm:text-4xl">Everything you need to diagram</h2>
			<p class="mx-auto mt-4 max-w-2xl text-ink-muted">
				A focused toolset for technical diagrams — no clutter, no learning curve.
			</p>
		</div>
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each features as f (f.title)}
				{@const Icon = f.icon}
				<div
					class="rounded-xl border border-line-soft bg-white p-6 transition-colors
						hover:border-mq-red/40"
				>
					<div
						class="mb-4 flex size-11 items-center justify-center rounded-lg bg-mq-red/10 text-mq-red"
					>
						<Icon size={20} />
					</div>
					<h3 class="font-semibold text-ink">{f.title}</h3>
					<p class="mt-2 text-sm leading-relaxed text-ink-muted">{f.desc}</p>
				</div>
			{/each}
		</div>
	</div>
</section>
