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
		/** Countdown for wrong answer (1.0 → 0.0), drives fill bar */
		countdownPct?: number;
		/** Called when wrong answer card is tapped (replay) */
		onWrongClick?: (() => void) | null;
		/** Called with choiceId when any answer card is tapped in result mode */
		onAnswerReplay?: ((choiceId: string) => void) | null;
		offline?: boolean;
	}
	let { choices, onselect, disabled = false, correctId = null, selectedId = null, onCorrectClick = null, countdownPct = -1, onWrongClick = null, onAnswerReplay = null, offline = false }: Props = $props();

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
		{@const isWrongBtn = selectedId != null && choice.id === selectedId && choice.id !== correctId}
		<button
			class="answer {btnClass(choice.id)}"
			class:skip={isCorrectBtn && onCorrectClick && !onAnswerReplay}
			class:has-advance={isCorrectBtn && onCorrectClick && onAnswerReplay}
			class:offline={offline}
			onclick={() => {
				if (onAnswerReplay) {
					onAnswerReplay(choice.id);
				} else if (isCorrectBtn && onCorrectClick) {
					onCorrectClick();
				} else if (isWrongBtn && onWrongClick) {
					onWrongClick();
				} else {
					onselect(choice);
				}
			}}
			disabled={onAnswerReplay ? false : (isCorrectBtn && onCorrectClick ? false : isWrongBtn && onWrongClick ? false : disabled)}
		>
			{#if isWrongBtn && countdownPct >= 0}
				<div class="countdown-fill" style="width: {Math.max(0, countdownPct) * 100}%"></div>
			{/if}
			<span class="id">{choice.label ?? choice.id}</span>
			<span class="name">{choice.name}</span>
			{#if isCorrectBtn && onCorrectClick && onAnswerReplay}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<span class="skip-btn" role="button" tabindex="-1" onclick={(e) => { e.stopPropagation(); onCorrectClick?.(); }}>
					<span class="skip-arrow">{'\uE011'}</span>
				</span>
			{:else if isCorrectBtn && onCorrectClick && !onAnswerReplay}
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
	.answer:not(:disabled):active { background: var(--surface-raised); border-color: var(--quiz-accent, var(--accent)); }
	.id {
		display: block; font-size: 2rem; font-weight: 900;
		font-family: 'BPdots', 'JetBrains Mono', monospace; letter-spacing: -0.02em;
		color: var(--quiz-accent, var(--accent));
		line-height: 1;
		transform: translateY(-1px);
	}
	.name {
		display: block; font-size: 0.65rem; color: var(--text-secondary);
		margin-top: 0.2rem; letter-spacing: 0.1em; font-weight: 400;
		text-transform: uppercase; font-family: var(--font-display);
	}
	.correct { border-color: var(--quiz-accent, var(--correct)); background: color-mix(in srgb, var(--quiz-accent, var(--correct)) 6%, transparent); }
	.correct .id { color: var(--quiz-accent, var(--correct)); }
	.offline .id { color: var(--hot, #ED174F); }
	.offline .name { opacity: 0.4; }
	.wrong { border-color: var(--wrong); background: #ED174F10; }
	.wrong .id { color: var(--wrong); }
	.countdown-fill {
		position: absolute;
		top: 0; right: 0; bottom: 0;
		background: var(--wrong);
		opacity: 0.08;
		transition: width 0.1s linear;
	}
	.dim { opacity: 0.2; }
	/* In answer-replay mode (has-advance present), dim cards are still tappable */
	.dim:not(:disabled) { opacity: 0.35; }
	.skip-arrow {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--quiz-accent, var(--correct));
		opacity: 0.7;
	}
	/* Separate skip button — large tap target with border divider */
	.skip-btn {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 3rem;
		min-height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-left: 1px solid color-mix(in srgb, var(--quiz-accent, var(--correct)) 30%, transparent);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		z-index: 1;
	}
	.skip-btn:active {
		background: color-mix(in srgb, var(--quiz-accent, var(--correct)) 10%, transparent);
	}
	.skip-btn .skip-arrow {
		position: static;
		transform: none;
	}
	/* Correct card with advance button — pad right so text doesn't overlap arrow */
	.has-advance {
		padding-right: 3.5rem;
	}
</style>
