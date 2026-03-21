<script lang="ts">
	import type { IntervalDef } from '$lib/types';

	interface Props {
		choices: IntervalDef[];
		onselect: (choice: IntervalDef) => void;
		disabled?: boolean;
		correctId?: string | null;
		selectedId?: string | null;
	}
	let { choices, onselect, disabled = false, correctId = null, selectedId = null }: Props = $props();

	function btnClass(id: string): string {
		if (!selectedId) return '';
		if (id === correctId) return 'correct';
		if (id === selectedId && id !== correctId) return 'wrong';
		return 'dim';
	}
</script>

<div class="grid">
	{#each choices as choice}
		<button class="answer {btnClass(choice.id)}" onclick={() => onselect(choice)} disabled={disabled}>
			<span class="id">{choice.id}</span>
			<span class="name">{choice.name}</span>
		</button>
	{/each}
</div>

<style>
	.grid-container { width: 100%; }
	.grid-label {
		font-family: var(--mono); font-size: 0.55rem;
		color: var(--accent); opacity: 0.4;
		letter-spacing: 0.15em; margin-bottom: 0.5rem;
	}
	.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; width: 100%; }
	.answer {
		padding: 1.25rem 0.5rem; background: var(--surface);
		border: 2px solid var(--border-heavy); border-radius: 0;
		text-align: center; transition: border-color 0.15s, background 0.15s;
	}
	.answer:not(:disabled):active { background: var(--surface-raised); border-color: var(--accent); }
	.id {
		display: block; font-size: 1rem; font-weight: 900;
		font-family: var(--mono); letter-spacing: -0.02em;
		color: var(--accent);
	}
	.name {
		display: block; font-size: 0.65rem; color: var(--text-secondary);
		margin-top: 0.2rem; letter-spacing: 0.1em; font-weight: 400;
		text-transform: uppercase; font-family: var(--font-display);
	}
	.correct { border-color: var(--correct); background: #C2FE0C10; }
	.correct .id { color: var(--correct); }
	.wrong { border-color: var(--wrong); background: #ED174F10; }
	.wrong .id { color: var(--wrong); }
	.dim { opacity: 0.2; }
</style>
