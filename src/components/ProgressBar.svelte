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
	.progress-bar { display: flex; align-items: center; gap: 0.75rem; width: 100%; }
	.track { flex: 1; height: 6px; background: var(--border); border-radius: 1px; overflow: hidden; }
	.fill { height: 100%; background: var(--accent); transition: width 0.3s ease; }
	.label {
		font-size: 0.8rem; font-weight: 700;
		font-family: var(--mono); color: var(--text-secondary);
		min-width: 3rem; text-align: right; letter-spacing: 0.05em;
	}
</style>
