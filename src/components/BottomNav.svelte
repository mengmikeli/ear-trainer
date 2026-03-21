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
		<a href={tab.href} class="nav-tab chromatic" class:active={page.url.pathname === tab.href}>
			<span class="icon">{tab.icon}</span>
			<span class="label">{tab.label}</span>
		</a>
	{/each}
</nav>

<style>
	.bottom-nav {
		display: flex;
		justify-content: center;
		background: var(--surface);
		border-top: 1px solid var(--accent);
	}

	.nav-tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		flex: 1;
		padding: 0.7rem 1rem;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.55rem;
		font-weight: 500;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		transition: color 0.15s, background 0.15s;
	}

	.nav-tab.active {
		color: var(--accent);
		background: var(--accent-dim);
	}

	.icon {
		font-size: 1.1rem;
	}
</style>
