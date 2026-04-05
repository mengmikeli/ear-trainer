<script lang="ts">
	interface Props { current: number; total: number; }
	let { current, total }: Props = $props();
</script>

<div class="progress-bar">
	<div class="track">
		<div class="fill" style="width: {(current / total) * 100}%">
			<div class="cursor"></div>
		</div>
	</div>
	<span class="label">{current}/{total}</span>
</div>

<style>
	.progress-bar { display: flex; align-items: center; gap: 0.75rem; width: 100%; }
	.track { flex: 1; height: 2px; background: var(--border-heavy); border-radius: 0; overflow: visible; position: relative; }
	.fill { height: 100%; background: var(--marathon-blue); transition: width 0.3s ease; position: relative; }
	.cursor {
		position: absolute;
		right: -3px;
		top: 50%;
		transform: translateY(-50%);
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--marathon-blue);
	}
	.label {
		font-size: 0.45rem; font-weight: 800;
		font-family: var(--mono); color: var(--marathon-blue);
		min-width: 3rem; text-align: right; letter-spacing: 0.05em;
	}
</style>
