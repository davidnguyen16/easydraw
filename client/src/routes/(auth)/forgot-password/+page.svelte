<script lang="ts">
	import { Mail } from '@lucide/svelte';
	import { API_URL } from '$lib/api';

	let email = $state('');
	let sent = $state(false);
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			await fetch(`${API_URL}/auth/forgot-password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			// The server always responds the same way (anti-enumeration), so we
			// show one confirmation regardless of whether the account exists.
			sent = true;
		} catch {
			error = 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<h1 class="text-center text-3xl font-bold text-ink">Forgot your password?</h1>
<p class="mt-2 text-center text-ink-muted">We'll email you a link to reset it</p>

<div class="mt-8 w-full rounded-2xl border border-line bg-white p-7 shadow-sm">
	{#if sent}
		<div class="rounded-lg border border-line bg-panel p-4 text-sm text-ink-soft">
			If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your
			inbox.
		</div>
	{:else}
		<form onsubmit={handleSubmit} class="flex flex-col gap-5">
			{#if error}
				<p class="rounded-lg bg-mq-pink px-3 py-2 text-sm text-mq-red">{error}</p>
			{/if}

			<div class="flex flex-col gap-1.5">
				<label for="email" class="text-sm font-medium text-ink">Email</label>
				<div class="relative">
					<Mail
						size={18}
						class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
					/>
					<input
						id="email"
						type="email"
						bind:value={email}
						required
						placeholder="you@example.com"
						class="w-full rounded-lg border border-line py-2.5 pr-3 pl-10 text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
					/>
				</div>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-lg bg-mq-maroon py-2.5 font-semibold text-white hover:bg-mq-red disabled:opacity-60"
			>
				{loading ? 'Sending…' : 'Send reset link'}
			</button>
		</form>
	{/if}
</div>

<p class="mt-6 text-center text-sm text-ink-muted">
	<a href="/login" class="font-medium text-mq-red hover:underline">← Back to sign in</a>
</p>
