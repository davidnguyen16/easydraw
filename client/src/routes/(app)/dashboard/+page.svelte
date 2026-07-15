<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		Plus,
		ChevronDown,
		Settings,
		LogOut,
		FilePlus,
		FileText,
		Search,
		ArrowUpDown,
		Check,
		MoreHorizontal,
		FolderOpen,
		Pencil,
		Copy,
		Trash2
	} from '@lucide/svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { authStore, logout } from '$lib/stores/auth.store.svelte';
	import { API_URL } from '$lib/api';
	import NewDiagramDialog from '$lib/components/NewDiagramDialog.svelte';
	import DeleteDiagramDialog from '$lib/components/DeleteDiagramDialog.svelte';
	import RenameDiagramDialog from '$lib/components/RenameDiagramDialog.svelte';
	import { DIAGRAM_TYPE_MAP, type DiagramType } from '$lib/diagram-types';

	type Diagram = { id: string; title: string; type: string; updatedAt: string };

	let menuOpen = $state(false);
	let dialogOpen = $state(false);

	let diagrams = $state<Diagram[]>([]);
	let loading = $state(true);

	let search = $state('');
	type SortKey = 'recent' | 'oldest' | 'name-asc' | 'name-desc';
	let sortBy = $state<SortKey>('recent');
	let sortMenuOpen = $state(false);
	let menuFor = $state<string | null>(null);
	let deleteOpen = $state(false);
	let deleteTarget = $state<Diagram | null>(null);
	let renameOpen = $state(false);
	let renameTarget = $state<Diagram | null>(null);

	const sortOptions: { value: SortKey; label: string }[] = [
		{ value: 'recent', label: 'Recently updated' },
		{ value: 'oldest', label: 'Least recently updated' },
		{ value: 'name-asc', label: 'Name A–Z' },
		{ value: 'name-desc', label: 'Name Z–A' }
	];
	const currentSortLabel = $derived(sortOptions.find((o) => o.value === sortBy)?.label ?? '');

	const displayName = $derived(authStore.user?.name ?? authStore.user?.email ?? 'User');
	const initials = $derived(
		(authStore.user?.name ?? authStore.user?.email ?? 'U')
			.trim()
			.split(/\s+/)
			.map((w) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);

	const filtered = $derived(
		diagrams
			.filter((d) => d.title.toLowerCase().includes(search.trim().toLowerCase()))
			.sort((a, b) => {
				switch (sortBy) {
					case 'oldest':
						return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
					case 'name-asc':
						return a.title.localeCompare(b.title);
					case 'name-desc':
						return b.title.localeCompare(a.title);
					default:
						return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
				}
			})
	);

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function typeMeta(type: string) {
		return DIAGRAM_TYPE_MAP[type as DiagramType] ?? DIAGRAM_TYPE_MAP.erd;
	}

	async function handleCreateDiagram({ name, type }: { name: string; type: string }) {
		const res = await fetch(`${API_URL}/diagrams`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: name, type })
		});
		if (!res.ok) return;
		const created = await res.json();
		goto(`/editor/${created.id}`);
	}

	function openDiagram(d: Diagram) {
		menuFor = null;
		goto(`/editor/${d.id}`);
	}

	function askRename(d: Diagram) {
		menuFor = null;
		renameTarget = d;
		renameOpen = true;
	}

	async function confirmRename(name: string) {
		const d = renameTarget;
		if (!d) return;
		const res = await fetch(`${API_URL}/diagrams/${d.id}`, {
			method: 'PATCH',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: name })
		});
		if (res.ok) d.title = name;
	}

	async function duplicateDiagram(d: Diagram) {
		menuFor = null;
		// The list doesn't carry `data`, so fetch the full diagram first, then copy it.
		const src = await fetch(`${API_URL}/diagrams/${d.id}`, { credentials: 'include' });
		if (!src.ok) return;
		const full = await src.json();
		const res = await fetch(`${API_URL}/diagrams`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: `${d.title} (copy)`, type: d.type, data: full.data })
		});
		if (!res.ok) return;
		const created = await res.json();
		diagrams = [
			{
				id: created.id,
				title: created.title,
				type: created.type,
				updatedAt: created.updatedAt
			},
			...diagrams
		];
	}

	function askDelete(d: Diagram) {
		menuFor = null;
		deleteTarget = d;
		deleteOpen = true;
	}

	async function confirmDelete() {
		const d = deleteTarget;
		if (!d) return;
		const res = await fetch(`${API_URL}/diagrams/${d.id}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		if (res.ok) diagrams = diagrams.filter((x) => x.id !== d.id);
	}

	async function handleLogout() {
		menuOpen = false;
		await logout();
		goto('/login');
	}

	function openSettings() {
		menuOpen = false;
		goto('/settings');
	}

	onMount(async () => {
		try {
			const res = await fetch(`${API_URL}/diagrams`, { credentials: 'include' });
			if (res.ok) diagrams = await res.json();
		} finally {
			loading = false;
		}
	});
</script>

<div class="min-h-screen bg-panel">
	<!-- Header -->
	<header class="border-b border-line-soft bg-white">
		<div class="flex w-full items-center justify-between px-5 py-4 sm:px-8">
			<Logo size="md" />

			<div class="flex items-center gap-4">
				<button
					onclick={() => (dialogOpen = true)}
					class="flex min-h-11 items-center gap-2 rounded-xl bg-mq-red px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mq-red-hover"
				>
					<Plus size={18} strokeWidth={2.25} />
					New Diagram
				</button>

				<!-- User menu -->
				<div class="relative">
					<button
						onclick={() => (menuOpen = !menuOpen)}
						class="flex min-h-11 items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 transition-colors hover:bg-surface-hover"
					>
						<span
							class="flex size-9 items-center justify-center rounded-full bg-mq-maroon text-xs font-semibold text-white"
						>
							{initials}
						</span>
						<span class="hidden max-w-40 truncate text-sm font-medium text-ink sm:block"
							>{displayName}</span
						>
						<ChevronDown size={16} class="text-ink-muted" />
					</button>

					{#if menuOpen}
						<!-- click-outside backdrop -->
						<button
							class="fixed inset-0 z-10 cursor-default"
							onclick={() => (menuOpen = false)}
							aria-label="Close menu"
							tabindex="-1"
						></button>
						<div
							class="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-white shadow-lg"
						>
							<div class="border-b border-line px-3 py-2.5">
								<p class="truncate text-sm font-medium text-ink">{displayName}</p>
								<p class="truncate text-xs text-ink-muted">
									{authStore.user?.email}
								</p>
							</div>
							<button
								onclick={openSettings}
								class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-hover"
							>
								<Settings size={16} />
								Settings
							</button>
							<button
								onclick={handleLogout}
								class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-hover"
							>
								<LogOut size={16} />
								Log out
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<!-- Content -->
	<main class="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
		<h1 class="text-3xl font-bold tracking-tight text-ink">My Diagrams</h1>
		<p class="mt-1.5 text-base text-ink-muted">Create and manage your technical diagrams</p>

		{#if loading}
			<p class="mt-9 text-center text-ink-muted">Loading...</p>
		{:else if diagrams.length === 0}
			<section
				class="mt-9 flex min-h-[390px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-line-soft bg-white px-6 py-14 text-center shadow-[0_12px_40px_rgba(44,44,42,0.05)] sm:px-10"
			>
				<div
					class="flex size-20 items-center justify-center rounded-3xl bg-mq-pink ring-8 ring-mq-pink/45"
				>
					<FilePlus size={34} strokeWidth={1.8} class="text-mq-red" />
				</div>
				<h2 class="mt-7 text-2xl font-semibold tracking-tight text-ink">No diagrams yet</h2>
				<p class="mt-2 max-w-md text-base leading-7 text-ink-muted">
					Create your first diagram to get started. Choose from ERD, UML, flowcharts, and
					more.
				</p>
				<button
					onclick={() => (dialogOpen = true)}
					class="mt-7 flex min-h-12 items-center gap-2.5 rounded-xl bg-mq-red px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-mq-red-hover"
				>
					<FileText size={18} />
					Create your first diagram
				</button>
			</section>
		{:else}
			<!-- Search + Sort -->
			<div class="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
				<div class="relative sm:max-w-sm sm:flex-1">
					<Search
						size={18}
						class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
					/>
					<input
						bind:value={search}
						placeholder="Search diagrams..."
						class="w-full rounded-lg border border-line bg-white py-2.5 pr-3 pl-10 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
					/>
				</div>

				<div class="relative">
					<button
						onclick={() => (sortMenuOpen = !sortMenuOpen)}
						class="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
					>
						<ArrowUpDown size={16} class="text-ink-muted" />
						{currentSortLabel}
						<ChevronDown
							size={16}
							class="text-ink-muted transition-transform {sortMenuOpen
								? 'rotate-180'
								: ''}"
						/>
					</button>

					{#if sortMenuOpen}
						<button
							class="fixed inset-0 z-10 cursor-default"
							onclick={() => (sortMenuOpen = false)}
							aria-label="Close"
							tabindex="-1"
						></button>
						<div
							class="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg"
						>
							{#each sortOptions as opt (opt.value)}
								<button
									onclick={() => {
										sortBy = opt.value;
										sortMenuOpen = false;
									}}
									class="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm {sortBy ===
									opt.value
										? 'bg-mq-pink font-medium text-mq-red'
										: 'text-ink hover:bg-surface-hover'}"
								>
									{opt.label}
									{#if sortBy === opt.value}
										<Check size={16} class="flex-shrink-0" />
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Grid -->
			{#if filtered.length === 0}
				<p class="mt-12 text-center text-ink-muted">No diagrams match “{search}”.</p>
			{:else}
				<div
					class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
				>
					{#each filtered as d (d.id)}
						{@const meta = typeMeta(d.type)}
						{@const Icon = meta.icon}
						<div
							class="group relative overflow-hidden rounded-2xl border border-line-soft bg-white shadow-sm transition hover:border-mq-red hover:shadow-md"
						>
							<a href={`/editor/${d.id}`} class="block">
								<div
									class="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-panel/50"
								>
									<Icon
										size={40}
										strokeWidth={1.4}
										class="text-mq-red/70 transition-transform group-hover:scale-105"
									/>
									<span class="text-xs font-semibold tracking-wide text-mq-red/70"
										>{meta.label}</span
									>
								</div>
								<div class="border-t border-line-soft px-4 py-3">
									<p class="truncate text-sm font-medium text-ink">{d.title}</p>
									<p class="mt-0.5 text-xs text-ink-muted">
										Edited {formatDate(d.updatedAt)}
									</p>
								</div>
							</a>

							<!-- ⋯ actions button (shown on hover / while its menu is open) -->
							<button
								onclick={() => (menuFor = menuFor === d.id ? null : d.id)}
								aria-label="Diagram actions"
								class="absolute top-2 right-2 flex size-8 items-center justify-center rounded-lg border border-line bg-white text-ink-muted shadow-sm transition-opacity hover:text-ink {menuFor ===
								d.id
									? 'opacity-100'
									: 'opacity-0 group-hover:opacity-100'}"
							>
								<MoreHorizontal size={18} />
							</button>

							{#if menuFor === d.id}
								<button
									class="fixed inset-0 z-10 cursor-default"
									onclick={() => (menuFor = null)}
									aria-label="Close"
									tabindex="-1"
								></button>
								<div
									class="absolute top-11 right-2 z-20 w-40 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg"
								>
									<button
										onclick={() => openDiagram(d)}
										class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
									>
										<FolderOpen size={16} /> Open
									</button>
									<button
										onclick={() => askRename(d)}
										class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
									>
										<Pencil size={16} /> Rename
									</button>
									<button
										onclick={() => duplicateDiagram(d)}
										class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
									>
										<Copy size={16} /> Duplicate
									</button>
									<button
										onclick={() => askDelete(d)}
										class="mt-1 flex w-full items-center gap-2.5 border-t border-line px-3 py-2 text-left text-sm text-mq-red hover:bg-mq-pink"
									>
										<Trash2 size={16} /> Delete
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</main>

	<NewDiagramDialog bind:open={dialogOpen} onCreate={handleCreateDiagram} />

	<DeleteDiagramDialog
		bind:open={deleteOpen}
		name={deleteTarget?.title ?? ''}
		onConfirm={confirmDelete}
	/>

	<RenameDiagramDialog
		bind:open={renameOpen}
		currentName={renameTarget?.title ?? ''}
		onSave={confirmRename}
	/>
</div>
