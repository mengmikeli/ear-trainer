<script lang="ts">
	interface Props { current: number; total: number; }
	let { current, total }: Props = $props();
</script>

<div class="progress-bar">
	<div class="track">
		<div class="fill" style="width: {(current / total) * 100}%"></div>
	</div>
	<span class="label">{current}/{total}</span>
</div>

<style>
	.progress-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}

	.track {
		flex: 1;
		height: 4px;
		background: var(--border);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.3s ease;
	}

	.label {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--accent);
		min-width: 3rem;
		text-align: right;
		letter-spacing: 0.05em;
		font-variant-numeric: tabular-nums;
	}
</style>
