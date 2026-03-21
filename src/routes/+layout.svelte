<script lang="ts">
	import '../app.css';
	import BottomNav from '../components/BottomNav.svelte';
	import { page } from '$app/state';

	let { children } = $props();

	// Hide bottom nav on quiz screen
	const showNav = $derived(page.url.pathname !== '/quiz');
</script>

<div class="app scanlines noise-grain">
	<main class="content screen-enter" class:no-nav={!showNav}>
		{@render children()}
	</main>
	{#if showNav}
		<BottomNav />
	{/if}
</div>

<style>
	.app {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100dvh;
		max-width: 480px;
		margin: 0 auto;
		overflow: hidden;
	}
	.content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem 1.25rem;
		padding-bottom: 1rem;
	}
	.content.no-nav {
		padding-bottom: 1.5rem;
	}
</style>
