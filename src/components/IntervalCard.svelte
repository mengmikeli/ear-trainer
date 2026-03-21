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
	.card { display: grid; grid-template-columns: 3rem 1fr 60px; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--surface); border-radius: 4px; }
	.locked { opacity: 0.4; }
	.id { font-size: 1.1rem; font-weight: 700; font-family: 'SF Mono', 'Fira Code', monospace; text-align: center; }
	.name { font-weight: 600; font-size: 0.9rem; }
	.stats { font-size: 0.75rem; color: var(--text-secondary); }
	.bar { height: 4px; background: #222; border-radius: 2px; overflow: hidden; }
	.bar-fill { height: 100%; background: var(--accent); }
</style>
