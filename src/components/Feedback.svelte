<script lang="ts">
	interface Props { correct: boolean; correctAnswer: string; visible: boolean; }
	let { correct, correctAnswer, visible }: Props = $props();
</script>

{#if visible}
	<div class="feedback" class:correct class:wrong={!correct}>
		<div class="flash-icon">
			{#if correct}
				<span class="icon-char">▲</span>
				<span class="icon-label">CORRECT</span>
			{:else}
				<span class="icon-char">▼</span>
				<span class="icon-label">WRONG</span>
				<span class="answer">{correctAnswer}</span>
			{/if}
		</div>
	</div>
{/if}

<style>
	.feedback {
		position: fixed; top: 0; left: 0; right: 0; bottom: 0;
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		pointer-events: none; z-index: 100; animation: flash 0.25s ease-out;
	}
	.correct { background: #C2FE0C12; }
	.wrong { background: #ED174F12; }
	.flash-icon {
		display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
	}
	.icon-char {
		font-size: 5rem; font-weight: 900; font-family: var(--mono);
	}
	.correct .icon-char { color: var(--correct); text-shadow: 0 0 40px #C2FE0C50; }
	.wrong .icon-char { color: var(--wrong); text-shadow: 0 0 40px #ED174F50; }
	.icon-label {
		font-size: 0.7rem; font-weight: 900; font-family: var(--mono);
		letter-spacing: 0.35em;
	}
	.correct .icon-label { color: var(--correct); }
	.wrong .icon-label { color: var(--wrong); }
	.answer {
		font-size: 1.3rem; font-weight: 800; margin-top: 0.5rem;
		color: var(--text-primary); letter-spacing: 0.05em;
		font-family: var(--font-display);
	}
	@keyframes flash { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
</style>
