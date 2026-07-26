<script lang="ts">
	import { Lock, Eye, EyeOff, CircleCheck } from '@lucide/svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { API_URL } from '$lib/api';

	// Reset token arrives as ?token=... in the emailed link.
	const token = $derived(page.url.searchParams.get('token'));

	let password = $state('');
	let confirm = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let error = $state('');
	let done = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';

		if (!token) {
			error = 'This reset link is invalid or is missing its token.';
			return;
		}
		if (password !== confirm) {
			error = 'Passwords do not match';
			return;
		}
		if (password.length < 6) {
			error = 'Password must be at least 6 characters';
			return;
		}

		loading = true;
		try {
			const res = await fetch(`${API_URL}/auth/reset-password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, password })
			});

			if (!res.ok) {
				error =
					res.status === 400
						? 'This reset link is invalid or has expired. Please request a new one.'
						: 'Something went wrong. Please try again.';
				return;
			}

			done = true;
			// Brief pause so the success message is seen, then off to sign in.
			setTimeout(() => goto('/login'), 1800);
		} catch {
			error = 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<h1 class="text-center text-3xl font-bold text-ink">Reset your password</h1>
<p class="mt-2 text-center text-ink-muted">Enter a new password for your account</p>

<div class="mt-8 w-full rounded-2xl border border-line bg-white p-7 shadow-sm">
	{#if done}
		<div class="flex flex-col items-center gap-3 py-4 text-center">
			<CircleCheck size={44} class="text-green-600" />
			<p class="text-sm text-ink-soft">Your password has been reset. Redirecting you to sign in…</p>
			<a href="/login" class="text-sm font-medium text-mq-red hover:underline">Go to sign in</a>
		</div>
	{:else}
		<form onsubmit={handleSubmit} class="flex flex-col gap-5">
			{#if error}
				<p class="rounded-lg bg-mq-pink px-3 py-2 text-sm text-mq-red">{error}</p>
			{/if}

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
				disabled={loading}
				class="w-full rounded-lg bg-mq-maroon py-2.5 font-semibold text-white hover:bg-mq-red disabled:opacity-60"
			>
				{loading ? 'Resetting…' : 'Reset password'}
			</button>
		</form>
	{/if}
</div>

<p class="mt-6 text-center text-sm text-ink-muted">
	<a href="/login" class="font-medium text-mq-red hover:underline">← Back to sign in</a>
</p>
