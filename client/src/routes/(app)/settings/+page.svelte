<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Calendar, LogOut, ShieldAlert, Trash2, User } from '@lucide/svelte';
	import Logo from '$lib/components/Logo.svelte';
	import DeleteAccountDialog from '$lib/components/DeleteAccountDialog.svelte';
	import { accountInitials, authStore, deleteAccount, logout } from '$lib/stores/auth.store.svelte';

	let deleteDialogOpen = $state(false);

	const displayName = $derived(authStore.user?.name?.trim() || 'Unnamed');
	const email = $derived(authStore.user?.email ?? '');
	const initials = $derived(accountInitials(authStore.user));

	function formatDate(value?: string) {
		if (!value) return '—';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return date.toLocaleDateString('en-GB', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	async function handleLogout() {
		try {
			await logout();
		} finally {
			await goto('/login');
		}
	}

	async function handleDeleteAccount() {
		await deleteAccount();
		await goto('/login');
	}
</script>

<svelte:head>
	<title>Settings | EasyDraw</title>
	<meta name="description" content="Manage your EasyDraw account." />
</svelte:head>

<div class="min-h-screen bg-panel">
	<header class="sticky top-0 z-30 border-b border-line bg-white/80 backdrop-blur-md">
		<div class="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
			<div class="flex items-center gap-3">
				<button
					type="button"
					onclick={() => goto('/dashboard')}
					aria-label="Back to dashboard"
					class="flex size-9 items-center justify-center rounded-lg text-ink transition-colors
						hover:bg-surface-hover"
				>
					<ArrowLeft size={17} />
				</button>
				<Logo size="md" />
			</div>

			<button
				type="button"
				onclick={handleLogout}
				class="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink
					transition-colors hover:bg-surface-hover"
			>
				<LogOut size={17} />
				<span class="hidden sm:inline">Sign out</span>
			</button>
		</div>
	</header>

	<main class="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
		<div>
			<h1 class="text-2xl font-semibold text-ink">Settings</h1>
			<p class="mt-1 text-sm text-ink-muted">Manage your account information</p>
		</div>

		<section class="space-y-5 rounded-xl border border-line bg-white p-5 sm:p-6">
			<div class="flex items-center gap-2">
				<User size={16} class="text-ink-muted" />
				<h2 class="text-sm font-semibold tracking-wider text-ink-muted uppercase">
					Profile
				</h2>
			</div>

			<div class="flex items-center gap-4">
				<div
					class="flex size-16 flex-shrink-0 items-center justify-center rounded-full bg-mq-maroon
						text-lg font-semibold text-white"
					aria-hidden="true"
				>
					{initials}
				</div>
				<div class="min-w-0">
					<p class="truncate text-base font-medium text-ink">{displayName}</p>
					<p class="truncate text-sm text-ink-muted">{email}</p>
				</div>
			</div>

			<div class="flex items-center gap-2 pt-2 text-sm text-ink-muted">
				<Calendar size={14} class="flex-shrink-0" />
				<span>Joined {formatDate(authStore.user?.createdAt)}</span>
			</div>
		</section>

		<section class="space-y-4 rounded-xl border border-red-200 bg-white p-5 sm:p-6">
			<div class="flex items-center gap-2">
				<ShieldAlert size={16} class="text-red-600" />
				<h2 class="text-sm font-semibold tracking-wider text-red-600 uppercase">
					Danger Zone
				</h2>
			</div>

			<div class="flex flex-col justify-between gap-4 py-2 sm:flex-row sm:items-center">
				<div class="min-w-0">
					<p class="text-sm font-medium text-ink">Delete account</p>
					<p class="mt-0.5 text-xs leading-5 text-ink-muted">
						Permanently delete your account and all your diagrams. This action cannot be
						undone.
					</p>
				</div>

				<button
					type="button"
					onclick={() => (deleteDialogOpen = true)}
					class="flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-red-600 px-4
						py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
				>
					<Trash2 size={15} />
					Delete account
				</button>
			</div>
		</section>
	</main>
</div>

<DeleteAccountDialog bind:open={deleteDialogOpen} onConfirm={handleDeleteAccount} />
