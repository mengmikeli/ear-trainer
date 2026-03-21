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
	.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; width: 100%; }
	.answer {
		padding: 1.25rem 0.5rem; background: var(--surface); border: 1px solid #333;
		border-radius: 4px; text-align: center; transition: border-color 0.15s, background 0.15s;
	}
	.answer:not(:disabled):active { background: #252525; }
	.id { display: block; font-size: 1.25rem; font-weight: 700; font-family: 'SF Mono', 'Fira Code', monospace; letter-spacing: -0.02em; }
	.name { display: block; font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; }
	.correct { border-color: var(--correct); background: #00ff8810; }
	.wrong { border-color: var(--wrong); background: #ff335510; }
	.dim { opacity: 0.3; }
</style>
