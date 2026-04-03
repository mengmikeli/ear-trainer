<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';

	const tabs = [
		{ href: `${base}/quiz`, label: 'PRACTICE', icon: '\uE014' },
		{ href: `${base}/progress`, label: 'PROGRESS', icon: '\uE002' },
		{ href: `${base}/settings`, label: 'SETTINGS', icon: '\uE015' },
	];

	const isQuiz = $derived(page.url.pathname.startsWith(`${base}/quiz`));

	function isActive(href: string): boolean {
		if (href === `${base}/quiz`) return page.url.pathname === `${base}/` || page.url.pathname.startsWith(`${base}/quiz`);
		return page.url.pathname === href;
	}
</script>

<nav class="side-nav">
	<a href="{base}/" class="brand">
		<span class="brand-title">EAR</span>
		<span class="brand-accent">TRAINER</span>
	</a>

	<div class="brand-divider"></div>

	<div class="nav-items">
		{#each tabs as tab}
			{#if isQuiz && tab.href === `${base}/quiz`}
				<span class="nav-item active disabled">
					<span class="icon">{tab.icon}</span>
					<span class="label">{tab.label}</span>
				</span>
			{:else}
				<a href={tab.href} class="nav-item" class:active={isActive(tab.href)}>
					<span class="icon">{tab.icon}</span>
					<span class="label">{tab.label}</span>
				</a>
			{/if}
		{/each}
	</div>

	<div class="side-nav-footer">
		<div class="tick-ruler"></div>
		<span class="sys-label">SYS ONLINE</span>
	</div>
</nav>

<style>
	/* ── Shell ── */
	.side-nav {
		display: flex;
		flex-direction: column;
		width: 200px;
		min-width: 200px;
		height: 100dvh;
		background: var(--surface);
		border-right: 1px solid var(--border-heavy);
		padding: 2rem 1rem;
	}

	/* ── Brand — matches page heading rhythm ── */
	.brand {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-bottom: 0.75rem;
		text-decoration: none;
		cursor: pointer;
	}

	.brand-title {
		font-family: var(--font-display);
		font-size: 3rem;
		font-weight: 400;
		letter-spacing: 0.05em;
		color: var(--accent);
		text-transform: uppercase;
		line-height: 1;
	}

	.brand-accent {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 400;
		letter-spacing: 0.12em;
		color: var(--accent);
		line-height: 1;
		margin-top: 0.25rem;
	}

	/* Divider — matches page heading border-bottom */
	.brand-divider {
		height: 2px;
		background: var(--border-heavy);
		margin-bottom: 1rem;
	}

	/* ── Nav items ── */
	.nav-items {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}

	.nav-item {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 0.65rem 0.5rem;
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-weight: 400;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		font-family: var(--font-display);
		border: 1px solid var(--border-heavy);
		transition: all 0.15s;
		text-decoration: none;
		cursor: pointer;
	}

	.nav-item:hover:not(.disabled) {
		color: var(--text-primary);
		border-color: var(--text-secondary);
	}

	.nav-item.active {
		color: var(--marathon-blue);
		border-color: var(--marathon-blue);
	}

	.nav-item.disabled {
		cursor: default;
	}

	.icon {
		font-size: 1.1rem;
		font-family: var(--mono);
		width: 1.5rem;
		text-align: center;
	}

	.label {
		font-size: 0.6rem;
	}

	/* ── Footer ── */
	.side-nav-footer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.sys-label {
		font-family: var(--mono);
		font-size: 0.3rem;
		letter-spacing: 0.2em;
		color: var(--text-secondary);
		text-align: center;
		opacity: 0.5;
	}
</style>
