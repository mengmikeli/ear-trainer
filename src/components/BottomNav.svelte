<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{ href: '/', label: 'PRACTICE', icon: '[▶]' },
		{ href: '/progress', label: 'PROGRESS', icon: '[≡]' },
		{ href: '/settings', label: 'SETTINGS', icon: '[⚙]' },
	];

	const isQuiz = $derived(page.url.pathname === '/quiz');

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/' || page.url.pathname === '/quiz';
		return page.url.pathname === href;
	}
</script>

<nav class="bottom-nav">
	{#each tabs as tab}
		{#if isQuiz && tab.href === '/'}
			<span class="nav-item active disabled">
				<span class="icon">{tab.icon}</span>
				<span class="label">{tab.label}</span>
			</span>
		{:else}
			<a href={tab.href} class:active={isActive(tab.href)}>
				<span class="icon">{tab.icon}</span>
				<span class="label">{tab.label}</span>
			</a>
		{/if}
	{/each}
</nav>

<style>
	.bottom-nav {
		display: flex; justify-content: center; gap: 0;
		background: var(--surface);
		border-top: 2px solid var(--border-heavy);
	}
	a, .nav-item {
		display: flex; flex-direction: column; align-items: center; gap: 0.15rem;
		flex: 1; padding: 0.7rem 1rem;
		color: var(--text-secondary); font-size: 0.6rem; font-weight: 400;
		letter-spacing: 0.15em; text-transform: uppercase; transition: all 0.15s;
		font-family: var(--font-display);
		border-top: 2px solid transparent;
		margin-top: -2px;
	}
	a.active, .nav-item.active { color: var(--marathon-blue); border-top: 2px solid var(--marathon-blue); }
	.disabled { cursor: default; }
	.icon { font-size: 1.2rem; }
</style>
