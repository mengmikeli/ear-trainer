<script lang="ts">
	import type { IntervalDef, IntervalState } from '$lib/types';

	interface Props { def: IntervalDef; state: IntervalState; }
	let { def, state }: Props = $props();

	const accuracy = $derived(
		state.attempts > 0 ? Math.round((state.correct / state.attempts) * 100) : 0
	);
</script>

<div class="card" class:locked={!state.unlocked}>
	<div class="id-col">
		{#if state.unlocked}
			<span class="interval-id">{def.id}</span>
		{:else}
			<span class="lock-icon">🔒</span>
		{/if}
	</div>
	<div class="info-col">
		<div class="name">{def.name}</div>
		{#if state.unlocked}
			<div class="meta">{accuracy}% · {state.attempts} attempts</div>
		{:else}
			<div class="meta">TIER {def.tier} — LOCKED</div>
		{/if}
	</div>
	{#if state.unlocked}
		<div class="bar-col">
			<div class="bar">
				<div
					class="bar-fill"
					style="width: {accuracy}%"
					class:high={accuracy >= 80}
					class:low={accuracy < 50 && state.attempts > 0}
				></div>
			</div>
		</div>
	{/if}
</div>

<style>
	.card {
		display: grid;
		grid-template-columns: 3.5rem 1fr 70px;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem;
		background: var(--surface);
		border-left: 2px solid var(--accent);
	}

	.locked {
		opacity: 0.25;
		border-left-color: var(--border);
	}

	.id-col {
		text-align: center;
	}

	.interval-id {
		font-family: var(--font-mono);
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		color: var(--accent);
	}

	.lock-icon {
		font-size: 1rem;
		opacity: 0.6;
	}

	.name {
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 0.85rem;
		letter-spacing: 0.02em;
	}

	.meta {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 500;
		color: var(--text-secondary);
		letter-spacing: 0.08em;
	}

	.bar-col {
		display: flex;
		align-items: center;
	}

	.bar {
		width: 100%;
		height: 4px;
		background: var(--border);
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.3s ease;
	}

	.bar-fill.high {
		background: var(--correct);
	}

	.bar-fill.low {
		background: var(--hot);
	}
</style>
