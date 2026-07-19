<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';

	const year = new Date().getFullYear();
</script>

<footer class="border-t border-line-soft bg-[#faf8f3]">
	<div
		class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row
			sm:px-6"
	>
		<Logo size="sm" />
		<p class="text-xs text-ink-muted">© {year} EasyDraw. All rights reserved.</p>
		<div class="flex items-center gap-4">
			<a href="/terms" class="text-xs text-ink-muted transition-colors hover:text-ink">Terms</a>
			<a href="/privacy" class="text-xs text-ink-muted transition-colors hover:text-ink">Privacy</a>
			<a href="/login" class="text-xs text-ink-muted transition-colors hover:text-ink">Sign in</a>
			<a href="/register" class="text-xs text-ink-muted transition-colors hover:text-ink">
				Get started
			</a>
		</div>
	</div>
</footer>
