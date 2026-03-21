<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{ href: '/', label: 'PRACTICE', icon: '\uE014' },
		{ href: '/progress', label: 'PROGRESS', icon: '\uE002' },
		{ href: '/settings', label: 'SETTINGS', icon: '\uE015' },
	];

	const isQuiz = $derived(page.url.pathname === '/quiz');

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/' || page.url.pathname === '/quiz';
		return page.url.pathname === href;
	}
</script>

<nav class="bottom-nav">
	<div class="tick-ruler"></div>
	<div class="nav-tabs">
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
	</div>
</nav>

<style>
	.bottom-nav {
		background: var(--surface);
	}
	.nav-tabs {
		display: flex; justify-content: center; gap: 2px;
	}
	a, .nav-item {
		display: flex; flex-direction: column; align-items: center; gap: 0.15rem;
		flex: 1; padding: 0.7rem 1rem;
		color: var(--text-secondary); font-size: 0.6rem; font-weight: 400;
		letter-spacing: 0.15em; text-transform: uppercase; transition: all 0.15s;
		font-family: var(--font-display);
		border: 1px solid var(--border-heavy);
	}
	a.active, .nav-item.active {
		color: var(--accent);
		border-color: var(--accent);
	}
	.disabled { cursor: default; }
	.icon { font-size: 1.25rem; font-family: var(--mono); }
</style>
