<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{ href: '/', label: 'PRACTICE', icon: '▶' },
		{ href: '/progress', label: 'PROGRESS', icon: '◉' },
		{ href: '/settings', label: 'SETTINGS', icon: '⚙' },
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
		display: flex; justify-content: center; gap: 2rem;
		padding: 0.75rem 1rem; background: var(--surface); border-top: 1px solid #222;
	}
	a {
		display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
		color: var(--text-secondary); font-size: 0.65rem; font-weight: 600;
		letter-spacing: 0.1em; text-transform: uppercase; transition: color 0.15s;
	}
	a.active { color: var(--accent); }
	.icon { font-size: 1.25rem; }
</style>
