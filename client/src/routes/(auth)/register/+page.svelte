<script lang="ts">
	import { Mail, Lock, Eye, EyeOff, LoaderCircle } from '@lucide/svelte';
	import { API_URL } from '$lib/api';
	import GoogleIcon from '$lib/components/icons/GoogleIcon.svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.store.svelte';

	let email = $state('');
	let password = $state('');
	let confirm = $state('');
	let showPassword = $state(false);
	let showConfirm = $state(false);
	let error = $state('');
	let acceptedPolicies = $state(false);
	let isSubmitting = $state(false);
	let policyCheckbox: HTMLInputElement;

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';

		if (password !== confirm) {
			error = 'Passwords do not match';
			return;
		}

		isSubmitting = true;
		try {
			const res = await fetch(`${API_URL}/auth/register`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			if (!res.ok) {
				error = res.status === 409 ? 'Email already in use' : 'Something went wrong';
				return;
			}

			const data = await res.json();
			authStore.user = data.user;
			await goto('/dashboard');
		} catch {
			error = 'Could not create your account. Check your connection and try again.';
		} finally {
			isSubmitting = false;
		}
	}

	function handleGoogleSignUp(event: MouseEvent) {
		if (acceptedPolicies) return;

		event.preventDefault();
		policyCheckbox?.focus();
		policyCheckbox?.reportValidity();
	}
</script>

<svelte:head>
	<title>Create an account | EasyDraw</title>
	<meta name="description" content="Create a free EasyDraw account." />
</svelte:head>

<h1 class="text-center text-3xl font-bold text-ink">Create your account</h1>
<p class="mt-2 text-center text-ink-muted">Sign up to get started</p>

<div class="mt-8 w-full rounded-2xl border border-line bg-white p-7 shadow-sm">
	<form onsubmit={handleSubmit} class="flex flex-col gap-5">
		{#if error}
			<p class="rounded-lg bg-mq-pink px-3 py-2 text-sm text-mq-red" role="alert">
				{error}
			</p>
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
					autocomplete="email"
					placeholder="you@example.com"
					class="w-full rounded-lg border border-line py-2.5 pr-3 pl-10 text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
				/>
			</div>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="password" class="text-sm font-medium text-ink">Password</label>
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
					minlength="8"
					autocomplete="new-password"
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
					type={showConfirm ? 'text' : 'password'}
					bind:value={confirm}
					required
					minlength="8"
					autocomplete="new-password"
					placeholder="Re-enter your password"
					class="w-full rounded-lg border border-line py-2.5 pr-10 pl-10 text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
				/>
				<button
					type="button"
					onclick={() => (showConfirm = !showConfirm)}
					aria-label={showConfirm ? 'Hide password' : 'Show password'}
					class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
				>
					{#if showConfirm}
						<EyeOff size={18} />
					{:else}
						<Eye size={18} />
					{/if}
				</button>
			</div>
		</div>

		<div class="rounded-xl border border-line-soft bg-panel/70 p-3.5">
			<div class="flex items-start gap-3">
				<input
					bind:this={policyCheckbox}
					id="policy-consent"
					type="checkbox"
					bind:checked={acceptedPolicies}
					required
					aria-describedby="policy-consent-help"
					class="mt-0.5 size-4 flex-shrink-0 cursor-pointer accent-mq-red"
				/>
				<label for="policy-consent" class="cursor-pointer text-sm leading-5 text-ink">
					I agree to the
					<a
						href="/terms"
						target="_blank"
						rel="noreferrer"
						class="font-medium text-mq-red underline underline-offset-2 hover:text-mq-maroon"
					>
						Terms of Service
					</a>
					and acknowledge the
					<a
						href="/privacy"
						target="_blank"
						rel="noreferrer"
						class="font-medium text-mq-red underline underline-offset-2 hover:text-mq-maroon"
					>
						Privacy Policy
					</a>.
				</label>
			</div>
			<p id="policy-consent-help" class="mt-2 pl-7 text-xs leading-5 text-ink-muted">
				Required to create an EasyDraw account.
			</p>
		</div>

		<button
			type="submit"
			disabled={isSubmitting}
			class="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-mq-maroon py-2.5
				font-semibold text-white transition-colors hover:bg-mq-red disabled:cursor-not-allowed
				disabled:opacity-60"
		>
			{#if isSubmitting}
				<LoaderCircle size={17} class="animate-spin" aria-hidden="true" />
				Creating account…
			{:else}
				Create account
			{/if}
		</button>
	</form>

	<div class="my-5 flex items-center gap-3">
		<span class="h-px flex-1 bg-line"></span>
		<span class="text-xs text-ink-muted">OR</span>
		<span class="h-px flex-1 bg-line"></span>
	</div>

	<a
		href={`${API_URL}/auth/google`}
		onclick={handleGoogleSignUp}
		class="flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-white
			py-2.5 font-medium text-ink transition-colors hover:bg-surface-hover"
	>
		<GoogleIcon />
		Continue with Google
	</a>
</div>

<p class="mt-6 text-center text-sm text-ink-muted">
	Already have an account?
	<a href="/login" class="font-medium text-mq-red hover:underline">Sign in</a>
</p>
