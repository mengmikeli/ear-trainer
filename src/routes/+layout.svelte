<script lang="ts">
	import '../app.css';
	import BottomNav from '../components/BottomNav.svelte';

	let { children } = $props();
</script>

<div class="app">
	<main class="content">
		{@render children()}
	</main>
	<BottomNav />
</div>

<style>
	.app {
		display: flex; flex-direction: column; height: 100dvh;
		max-width: 480px; margin: 0 auto;
	}
	.content {
		flex: 1; overflow-y: auto; padding: 1.5rem 1rem;
	}
</style>
