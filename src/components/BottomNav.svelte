<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{ href: '/', label: 'PRACTICE', icon: '[▶]' },
		{ href: '/progress', label: 'PROGRESS', icon: '[≡]' },
		{ href: '/settings', label: 'SETTINGS', icon: '[⚙]' },
	];
</script>

<nav class="bottom-nav">
	{#each tabs as tab}
		<a href={tab.href} class:active={page.url.pathname === tab.href}>
			<span class="icon">{tab.icon}</span>
			<span class="label">{tab.label}</span>
		</a>
	{/each}
</nav>

<style>
	.bottom-nav {
		display: flex; justify-content: center; gap: 0;
		background: var(--surface);
		border-top: 2px solid var(--accent);
	}
	a {
		display: flex; flex-direction: column; align-items: center; gap: 0.15rem;
		flex: 1; padding: 0.7rem 1rem;
		color: var(--text-secondary); font-size: 0.6rem; font-weight: 400;
		letter-spacing: 0.15em; text-transform: uppercase; transition: all 0.15s;
		font-family: var(--font-display);
	}
	a.active { color: var(--accent); background: var(--accent-dim); }
	.icon { font-size: 1.2rem; }
</style>
