<script lang="ts">
	import type { IntervalDef, IntervalState } from '$lib/types';

	interface Props { def: IntervalDef; state: IntervalState; }
	let { def, state }: Props = $props();

	const accuracy = $derived(state.attempts > 0 ? Math.round((state.correct / state.attempts) * 100) : 0);
</script>

<div class="card" class:locked={!state.unlocked}>
	<div class="id">{state.unlocked ? def.id : '🔒'}</div>
	<div class="info">
		<div class="name">{def.name}</div>
		{#if state.unlocked}
			<div class="stats">{accuracy}% · {state.attempts} attempts</div>
		{:else}
			<div class="stats">Tier {def.tier} — locked</div>
		{/if}
	</div>
	{#if state.unlocked}
		<div class="bar">
			<div class="bar-fill" style="width: {accuracy}%"></div>
		</div>
	{/if}
</div>

<style>
	.card {
		display: grid; grid-template-columns: 3.5rem 1fr 70px;
		align-items: center; gap: 0.75rem; padding: 0.85rem;
		background: var(--surface); border: 1px solid var(--border);
		border-radius: 2px;
	}
	.locked { opacity: 0.35; }
	.id {
		font-size: 1.2rem; font-weight: 800;
		font-family: var(--mono); text-align: center;
		color: var(--accent);
	}
	.locked .id { color: var(--text-secondary); }
	.name { font-weight: 700; font-size: 0.85rem; letter-spacing: 0.02em; }
	.stats { font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; }
	.bar { height: 6px; background: var(--border); border-radius: 1px; overflow: hidden; }
	.bar-fill { height: 100%; background: var(--accent); }
</style>
