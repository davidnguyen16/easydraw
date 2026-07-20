<script lang="ts">
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import Hero from '$lib/components/landing/Hero.svelte';
	import DiagramTypes from '$lib/components/landing/DiagramTypes.svelte';
	import Features from '$lib/components/landing/Features.svelte';
	import HowItWorks from '$lib/components/landing/HowItWorks.svelte';
	import FinalCTA from '$lib/components/landing/FinalCTA.svelte';
	import LandingFooter from '$lib/components/landing/LandingFooter.svelte';
</script>

<svelte:head>
	<title>EasyDraw — Design technical diagrams with ease</title>
	<meta
		name="description"
		content="ERDs and flowcharts in a clean, intuitive canvas — with flexible shapes for UML and data-flow diagrams. Free to use."
	/>
</svelte:head>

<!-- Warm cream page ground (#FAF8F3, fully opaque) under the glassy
     white/80 sticky header — scrolled content shows through the header's
     backdrop blur, everything below sits on cream. -->
<div class="flex min-h-screen flex-col bg-[#faf8f3]">
	<LandingNav />
	<main class="flex-1">
		<Hero />
		<DiagramTypes />
		<Features />
		<HowItWorks />
		<FinalCTA />
	</main>
	<LandingFooter />
</div>
