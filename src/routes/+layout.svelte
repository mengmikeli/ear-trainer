<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import BottomNav from '../components/BottomNav.svelte';
	import { initTheme } from '$lib/theme';
	import { loadState } from '$lib/state';

	let { children } = $props();

	onMount(() => {
		const state = loadState();
		initTheme(state.settings.theme);
	});
</script>

<div class="app scanlines">
	<main class="content">
		{@render children()}
	</main>
	<BottomNav />
</div>

<style>
	.app {
		position: relative;
		display: flex; flex-direction: column; height: 100dvh;
		max-width: 480px; margin: 0 auto;
	}
	.content {
		flex: 1; overflow-y: auto; padding: 1.5rem 1.25rem;
	}
</style>
