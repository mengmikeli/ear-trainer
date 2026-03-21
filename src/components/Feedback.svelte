<script lang="ts">
	interface Props { correct: boolean; correctAnswer: string; visible: boolean; }
	let { correct, correctAnswer, visible }: Props = $props();
</script>

{#if visible}
	<div class="feedback" class:correct class:wrong={!correct}>
		<span class="icon">{correct ? '✓' : '✗'}</span>
		{#if !correct}
			<span class="answer">{correctAnswer}</span>
		{/if}
	</div>
{/if}

<style>
	.feedback {
		position: fixed; top: 0; left: 0; right: 0; bottom: 0;
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		pointer-events: none; z-index: 100; animation: flash 0.2s ease-out;
	}
	.correct { background: #C2FE0C18; }
	.wrong { background: #ED174F18; }
	.icon { font-size: 3.5rem; font-weight: 900; font-family: var(--mono); letter-spacing: -0.05em; }
	.correct .icon { color: var(--correct); text-shadow: 0 0 30px #C2FE0C60; }
	.wrong .icon { color: var(--wrong); text-shadow: 0 0 30px #ED174F60; }
	.answer { font-size: 1.5rem; font-weight: 800; margin-top: 0.5rem; color: var(--text-primary); letter-spacing: 0.05em; font-family: var(--font-display); }
	@keyframes flash { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
</style>
