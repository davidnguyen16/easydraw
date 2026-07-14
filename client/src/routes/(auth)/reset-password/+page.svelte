<script lang="ts">
	import { Lock, Eye, EyeOff } from '@lucide/svelte';
	import { page } from '$app/state';

	// Reset token normally arrives as ?token=... in the emailed link.
	const token = $derived(page.url.searchParams.get('token'));

	let password = $state('');
	let confirm = $state('');
	let showPassword = $state(false);

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		// TODO: POST `${API_URL}/auth/reset-password` with { token, password }, then goto('/login').
		console.log('reset-password', { token, password, confirm });
	}
</script>

<h1 class="text-center text-3xl font-bold text-ink">Reset your password</h1>
<p class="mt-2 text-center text-ink-muted">Enter a new password for your account</p>

<div class="mt-8 w-full rounded-2xl border border-line bg-white p-7 shadow-sm">
	<form onsubmit={handleSubmit} class="flex flex-col gap-5">
		<div class="flex flex-col gap-1.5">
			<label for="password" class="text-sm font-medium text-ink">New Password</label>
			<div class="relative">
				<Lock
					size={18}
					class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
				/>
				<input
					id="password"
					type={showPassword ? 'text' : 'password'}
					bind:value={password}
					required
					placeholder="Enter your new password"
					class="w-full rounded-lg border border-line py-2.5 pr-10 pl-10 text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
				/>
				<button
					type="button"
					onclick={() => (showPassword = !showPassword)}
					aria-label={showPassword ? 'Hide password' : 'Show password'}
					class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
				>
					{#if showPassword}
						<EyeOff size={18} />
					{:else}
						<Eye size={18} />
					{/if}
				</button>
			</div>
			<p class="text-xs text-ink-muted">At least 8 characters</p>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="confirm" class="text-sm font-medium text-ink">Confirm Password</label>
			<div class="relative">
				<Lock
					size={18}
					class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
				/>
				<input
					id="confirm"
					type="password"
					bind:value={confirm}
					required
					placeholder="Re-enter your new password"
					class="w-full rounded-lg border border-line py-2.5 pr-3 pl-10 text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
				/>
			</div>
		</div>

		<button
			type="submit"
			class="w-full rounded-lg bg-mq-maroon py-2.5 font-semibold text-white hover:bg-mq-red"
		>
			Reset password
		</button>
	</form>
</div>

<p class="mt-6 text-center text-sm text-ink-muted">
	<a href="/login" class="font-medium text-mq-red hover:underline">← Back to sign in</a>
</p>
