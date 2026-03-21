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
		<button
			class="answer chromatic {btnClass(choice.id)}"
			onclick={() => onselect(choice)}
			disabled={disabled}
		>
			<span class="id">{choice.id}</span>
			<span class="name">{choice.name}</span>
		</button>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		width: 100%;
	}

	.answer {
		padding: 1.25rem 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		text-align: center;
		transition: border-color 0.15s, background 0.15s;
	}

	.answer:not(:disabled):hover {
		border-color: var(--accent);
		background: var(--accent-dim);
	}

	.answer:not(:disabled):active {
		background: var(--surface-raised);
		border-color: var(--accent);
	}

	.id {
		display: block;
		font-family: var(--font-mono);
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		color: var(--accent);
	}

	.name {
		display: block;
		font-family: var(--font-body);
		font-size: 0.6rem;
		color: var(--text-secondary);
		margin-top: 0.25rem;
		letter-spacing: 0.08em;
		font-weight: 500;
		text-transform: uppercase;
	}

	/* Correct */
	.correct {
		border-color: var(--correct) !important;
		background: var(--correct-dim) !important;
	}
	.correct .id { color: var(--correct); }

	/* Wrong */
	.wrong {
		border-color: var(--wrong) !important;
		background: var(--hot-dim) !important;
	}
	.wrong .id { color: var(--wrong); }

	/* Dim other options */
	.dim { opacity: 0.15; }
</style>
