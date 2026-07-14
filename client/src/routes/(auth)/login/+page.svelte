<script lang="ts">
	import { Mail, Lock, Eye, EyeOff } from '@lucide/svelte';
	import { API_URL } from '$lib/api';
	import GoogleIcon from '$lib/components/icons/GoogleIcon.svelte';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		// TODO: POST `${API_URL}/auth/login` with credentials: 'include', then goto('/dashboard').
		console.log('login', { email, password });
	}
</script>

<h1 class="text-center text-3xl font-bold text-ink">Start designing your diagrams</h1>
<p class="mt-2 text-center text-ink-muted">Sign in to EasyDraw</p>

<div class="mt-8 w-full rounded-2xl border border-line bg-white p-7 shadow-sm">
	<form onsubmit={handleSubmit} class="flex flex-col gap-5">
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

		<div class="flex flex-col gap-1.5">
			<div class="flex items-center justify-between">
				<label for="password" class="text-sm font-medium text-ink">Password</label>
				<a href="/forgot-password" class="text-sm text-mq-red hover:underline">Forgot password?</a>
			</div>
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
					placeholder="Enter your password"
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
		</div>

		<button
			type="submit"
			class="mt-1 w-full rounded-lg bg-mq-maroon py-2.5 font-semibold text-white hover:bg-mq-red"
		>
			Sign in
		</button>
	</form>

	<div class="my-5 flex items-center gap-3">
		<span class="h-px flex-1 bg-line"></span>
		<span class="text-xs text-ink-muted">OR</span>
		<span class="h-px flex-1 bg-line"></span>
	</div>

	<a
		href={`${API_URL}/auth/google`}
		class="flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-white py-2.5 font-medium text-ink hover:bg-surface-hover"
	>
		<GoogleIcon />
		Continue with Google
	</a>
</div>

<p class="mt-6 text-center text-sm text-ink-muted">
	New to EasyDraw?
	<a href="/register" class="font-medium text-mq-red hover:underline">Create an account</a>
</p>
