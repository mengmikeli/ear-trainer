<script lang="ts">
	import type { IntervalDef, IntervalState } from '$lib/types';

	interface Props {
		def: IntervalDef;
		state: IntervalState;
		ontoggle?: (id: string) => void;
	}
	let { def, state, ontoggle }: Props = $props();

	const accuracy = $derived(state.attempts > 0 ? Math.round((state.correct / state.attempts) * 100) : 0);
</script>

<div class="card" class:locked={!state.unlocked} class:disabled={state.unlocked && !state.enabled}>
	<div class="card-fill" style="width: {state.unlocked && state.enabled ? accuracy : 0}%"></div>
	<div class="card-content">
		<div class="id">{state.unlocked ? def.id : '⊘'}</div>
		<div class="info">
			<div class="name">{def.name}</div>
			{#if state.unlocked}
				<div class="stats">{accuracy}% · {state.attempts} {state.attempts === 1 ? 'attempt' : 'attempts'}</div>
			{:else}
				<div class="stats">TIER {def.tier} // LOCKED</div>
			{/if}
		</div>
		{#if state.unlocked && ontoggle}
			<button class="toggle" class:toggle-off={!state.enabled} onclick={() => ontoggle?.(def.id)}>
				{state.enabled ? '[ON]' : '[OFF]'}
			</button>
		{:else if state.unlocked}
			<div class="acc-value">{accuracy}%</div>
		{/if}
	</div>
</div>

<style>
	.card {
		position: relative; overflow: hidden;
		background: var(--surface);
		border-left: 3px solid var(--accent);
		border-radius: 0;
	}
	.card-fill {
		position: absolute; top: 0; left: 0; bottom: 0;
		background: var(--accent);
		opacity: 0.07;
		transition: width 0.4s ease;
	}
	.card-content {
		position: relative; z-index: 1;
		display: grid; grid-template-columns: 3.5rem 1fr auto;
		align-items: center; gap: 0.75rem; padding: 0.85rem;
	}
	.locked { opacity: 0.4; border-left-color: var(--hot); }
	.disabled { opacity: 0.35; border-left-color: var(--border-heavy); }
	.disabled .id { color: var(--text-secondary); }
	.disabled .name { color: var(--text-secondary); }
	.id {
		font-size: 1.2rem; font-weight: 900;
		font-family: var(--mono); text-align: center;
		color: var(--accent);
	}
	.locked .id { color: var(--hot); font-size: 2rem; }
	.name { font-weight: 700; font-size: 0.85rem; letter-spacing: 0.02em; font-family: var(--font-display); }
	.stats { font-size: 0.65rem; color: var(--text-secondary); font-weight: 600; font-family: var(--mono); letter-spacing: 0.05em; }
	.acc-value {
		font-size: 1.1rem; font-weight: 900;
		font-family: var(--mono); color: var(--accent);
		letter-spacing: -0.02em;
	}
	.toggle {
		font-family: var(--mono); font-size: 0.7rem; font-weight: 900;
		letter-spacing: 0.05em; padding: 0.3rem 0.5rem;
		border: 1px solid var(--accent); background: var(--accent-dim);
		color: var(--accent); cursor: pointer;
		transition: all 0.15s;
	}
	.toggle-off {
		border-color: var(--border-heavy); background: transparent;
		color: var(--text-secondary);
	}
</style>
