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
		pointer-events: none; z-index: 100; animation: flash 0.25s ease-out;
	}
	.correct { background: #00ff8818; }
	.wrong { background: #ff335518; }
	.icon { font-size: 5rem; font-weight: 900; }
	.correct .icon { color: var(--correct); }
	.wrong .icon { color: var(--wrong); }
	.answer { font-size: 1.4rem; font-weight: 700; margin-top: 0.5rem; color: var(--text-primary); letter-spacing: 0.03em; }
	@keyframes flash { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>
