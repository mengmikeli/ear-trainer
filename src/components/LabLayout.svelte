<script lang="ts">
	/**
	 * LabLayout — shared layout wrapper for visualization pages.
	 * Provides the standard LAB shell: header, canvas frame, footer.
	 * Used by /lab and potentially future quiz viz integration.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		/** Current interval/chord ID displayed in header tag */
		label: string;
		/** Left footer tags (e.g. LISSAJOUS, CHLADNI) */
		footerLeft?: Snippet;
		/** Right footer text */
		footerRight?: string;
		/** Canvas slot */
		children: Snippet;
		/** Selector slot (below canvas) */
		selector?: Snippet;
	}

	let { label, footerLeft, footerRight, children, selector }: Props = $props();
</script>

<div class="lab-layout">
	<header class="lab-header">
		<div class="lab-title">
			<span class="hud-tag">LAB</span>
			<h1>VISUALIZATION</h1>
		</div>
		<div class="lab-meta">
			<span class="interval-tag">{label}</span>
		</div>
	</header>

	<div class="canvas-frame">
		{@render children()}
		<div class="frame-corner tl"></div>
		<div class="frame-corner tr"></div>
		<div class="frame-corner bl"></div>
		<div class="frame-corner br"></div>
	</div>

	{#if selector}
		<div class="selector-area">
			{@render selector()}
		</div>
	{/if}

	<footer class="lab-footer">
		{#if footerLeft}
			<div class="footer-tags">
				{@render footerLeft()}
			</div>
		{/if}
		{#if footerRight}
			<span class="freq-label">{footerRight}</span>
		{/if}
	</footer>
</div>

<style>
	.lab-layout {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		height: 100%;
	}

	.lab-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
	}

	.lab-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.lab-title h1 {
		font-family: var(--font-display);
		font-size: 1.2rem;
		letter-spacing: 0.15em;
		color: var(--text-primary);
	}

	.lab-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.interval-tag {
		font-family: 'BPdots', var(--mono);
		font-size: 1.6rem;
		font-weight: bold;
		color: var(--accent);
		border: 1px solid var(--accent);
		padding: 0.15rem 0.5rem 0.35rem;
		letter-spacing: 0.05em;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}

	.canvas-frame {
		position: relative;
		flex: 1;
		min-height: 0;
		border: 1px solid var(--border-heavy);
		background: #000;
	}

	.frame-corner {
		position: absolute;
		width: 12px;
		height: 12px;
		border-color: var(--accent);
		border-style: solid;
		opacity: 0.4;
	}
	.frame-corner.tl { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
	.frame-corner.tr { top: -1px; right: -1px; border-width: 2px 2px 0 0; }
	.frame-corner.bl { bottom: -1px; left: -1px; border-width: 0 0 2px 2px; }
	.frame-corner.br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }

	.selector-area {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		justify-content: center;
	}

	.lab-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
	}

	.footer-tags {
		display: flex;
		gap: 0.5rem;
	}

	.freq-label {
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--text-secondary);
		letter-spacing: 0.05em;
	}
</style>
