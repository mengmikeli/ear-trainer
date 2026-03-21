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
		pointer-events: none; z-index: 100; animation: flash 0.3s ease-out;
	}
	.correct { background: #00ff8815; }
	.wrong { background: #ff335515; }
	.icon { font-size: 4rem; font-weight: 700; }
	.correct .icon { color: var(--correct); }
	.wrong .icon { color: var(--wrong); }
	.answer { font-size: 1.25rem; font-weight: 600; margin-top: 0.5rem; color: var(--text-primary); }
	@keyframes flash { from { opacity: 0; } to { opacity: 1; } }
</style>
