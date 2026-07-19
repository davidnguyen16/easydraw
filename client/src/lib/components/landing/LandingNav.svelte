<script lang="ts">
	import { Menu, X, LayoutDashboard, LogOut } from '@lucide/svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { authStore, logout } from '$lib/stores/auth.store.svelte';

	const navLinks = [
		{ label: 'Features', href: '#features' },
		{ label: 'Diagram types', href: '#diagram-types' },
		{ label: 'How it works', href: '#how-it-works' }
	];

	let scrolled = $state(false);
	let mobileOpen = $state(false);
	let userMenuOpen = $state(false);

	// authStore.ready flips true after the first GET /auth/me resolves — until
	// then show skeletons instead of flashing the guest buttons at a
	// logged-in user.
	const isLoading = $derived(!authStore.ready);

	const initials = $derived(
		(authStore.user?.name ?? authStore.user?.email ?? 'U')
			.trim()
			.split(/\s+/)
			.map((w) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);

	async function handleLogout() {
		userMenuOpen = false;
		await logout();
	}
</script>

<svelte:window onscroll={() => (scrolled = window.scrollY > 8)} />

<header
	class="sticky top-0 z-40 bg-white/80 backdrop-blur-md transition-shadow {scrolled
		? 'border-b border-line-soft shadow-sm'
		: 'border-b border-transparent'}"
>
	<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
		<a href="/" aria-label="EasyDraw home"><Logo size="md" /></a>

		<nav class="hidden items-center gap-8 md:flex">
			{#each navLinks as l (l.href)}
				<a href={l.href} class="text-sm text-ink-muted transition-colors hover:text-ink">
					{l.label}
				</a>
			{/each}
		</nav>

		<div class="flex items-center gap-2">
			{#if isLoading}
				<div class="hidden h-9 w-20 animate-pulse rounded-lg bg-surface-hover sm:block"></div>
				<div class="h-9 w-32 animate-pulse rounded-lg bg-surface-hover"></div>
			{:else if authStore.isAuthenticated}
				<a
					href="/dashboard"
					class="flex h-9 items-center rounded-lg bg-mq-red px-3.5 text-sm font-medium text-white
						transition-colors hover:bg-mq-red-hover"
				>
					Open dashboard
				</a>
				<div class="relative">
					<button
						type="button"
						class="flex size-9 items-center justify-center rounded-full bg-mq-red/10 text-xs
							font-semibold text-mq-red transition-colors hover:bg-mq-red/20"
						aria-haspopup="menu"
						aria-expanded={userMenuOpen}
						onclick={() => (userMenuOpen = !userMenuOpen)}
					>
						{initials}
					</button>
					{#if userMenuOpen}
						<button
							class="fixed inset-0 z-10 cursor-default"
							aria-label="Close menu"
							tabindex="-1"
							onclick={() => (userMenuOpen = false)}
						></button>
						<div
							class="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-line
								bg-white py-1 shadow-lg"
							role="menu"
						>
							<a
								href="/dashboard"
								role="menuitem"
								class="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-hover"
								onclick={() => (userMenuOpen = false)}
							>
								<LayoutDashboard size={16} /> Dashboard
							</a>
							<div class="my-1 h-px bg-line-soft"></div>
							<button
								type="button"
								role="menuitem"
								class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#b42318]
									hover:bg-surface-hover"
								onclick={handleLogout}
							>
								<LogOut size={16} /> Log out
							</button>
						</div>
					{/if}
				</div>
			{:else}
				<a
					href="/login"
					class="hidden h-9 items-center rounded-lg px-3.5 text-sm font-medium text-ink
						transition-colors hover:bg-surface-hover sm:inline-flex"
				>
					Sign in
				</a>
				<a
					href="/register"
					class="flex h-9 items-center rounded-lg bg-mq-red px-3.5 text-sm font-medium text-white
						transition-colors hover:bg-mq-red-hover"
				>
					Get started free
				</a>
			{/if}

			<button
				type="button"
				class="flex size-9 items-center justify-center rounded-lg text-ink hover:bg-surface-hover
					md:hidden"
				aria-label="Toggle menu"
				onclick={() => (mobileOpen = !mobileOpen)}
			>
				{#if mobileOpen}<X size={20} />{:else}<Menu size={20} />{/if}
			</button>
		</div>
	</div>

	{#if mobileOpen}
		<div class="border-t border-line-soft bg-white/95 backdrop-blur-md md:hidden">
			<nav class="flex flex-col gap-1 px-4 py-3">
				{#each navLinks as l (l.href)}
					<a
						href={l.href}
						class="rounded-lg px-3 py-2.5 text-sm text-ink transition-colors hover:bg-surface-hover"
						onclick={() => (mobileOpen = false)}
					>
						{l.label}
					</a>
				{/each}
				{#if !isLoading && !authStore.isAuthenticated}
					<a
						href="/login"
						class="rounded-lg px-3 py-2.5 text-sm text-ink transition-colors hover:bg-surface-hover
							sm:hidden"
						onclick={() => (mobileOpen = false)}
					>
						Sign in
					</a>
				{/if}
			</nav>
		</div>
	{/if}
</header>
