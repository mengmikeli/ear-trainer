<script lang="ts">
	interface ChoiceItem {
		id: string;
		name: string;
		[key: string]: unknown;
	}

	interface Props {
		choices: ChoiceItem[];
		onselect: (choice: ChoiceItem) => void;
		disabled?: boolean;
		correctId?: string | null;
		selectedId?: string | null;
		onCorrectClick?: (() => void) | null;
	}
	let { choices, onselect, disabled = false, correctId = null, selectedId = null, onCorrectClick = null }: Props = $props();

	function btnClass(id: string): string {
		if (!selectedId) return '';
		if (id === correctId) return 'correct';
		if (id === selectedId && id !== correctId) return 'wrong';
		return 'dim';
	}
</script>

<div class="grid">
	{#each choices as choice}
		{@const isCorrectBtn = correctId != null && choice.id === correctId}
		<button
			class="answer {btnClass(choice.id)}"
			class:skip={isCorrectBtn && onCorrectClick}
			onclick={() => {
				if (isCorrectBtn && onCorrectClick) {
					onCorrectClick();
				} else {
					onselect(choice);
				}
			}}
			disabled={isCorrectBtn && onCorrectClick ? false : disabled}
		>
			<span class="id">{choice.label ?? choice.id}</span>
			<span class="name">{choice.name}</span>
			{#if isCorrectBtn && onCorrectClick}
				<span class="skip-arrow">{'\uE011'}</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	.grid-container { width: 100%; }
	.grid-label {
		font-family: var(--mono); font-size: 0.45rem;
		color: var(--accent); opacity: 0.4;
		letter-spacing: 0.15em; margin-bottom: 0.5rem;
	}
	.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; width: 100%; }
	.answer {
		position: relative;
		padding: 1.25rem 0.5rem; background: var(--surface);
		border: 1px solid var(--border-heavy); border-radius: 0;
		text-align: center; transition: border-color 0.15s, background 0.15s;
	}
	.answer:not(:disabled):active { background: var(--surface-raised); border-color: var(--accent); }
	.id {
		display: block; font-size: 2rem; font-weight: 900;
		font-family: 'BPdots', 'JetBrains Mono', monospace; letter-spacing: -0.02em;
		color: var(--accent);
		line-height: 1;
		transform: translateY(-1px);
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
	.skip-arrow {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--correct);
		opacity: 0.7;
	}
</style>
