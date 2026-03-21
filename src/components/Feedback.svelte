<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		correct: boolean;
		correctAnswer: string;
		visible: boolean;
	}
	let { correct, correctAnswer, visible }: Props = $props();

	let glitchActive = $state(false);

	$effect(() => {
		if (visible && !correct) {
			// Trigger glitch burst on wrong answer
			glitchActive = true;
			const timer = setTimeout(() => { glitchActive = false; }, 250);
			return () => clearTimeout(timer);
		} else {
			glitchActive = false;
		}
	});
</script>

{#if visible}
	<div
		class="feedback"
		class:correct
		class:wrong={!correct}
		class:glitch-burst={glitchActive}
	>
		<span class="icon" class:glitch-burst-color={glitchActive}>
			{correct ? '✓' : '✗'}
		</span>
		{#if !correct}
			<span class="answer">{correctAnswer}</span>
		{/if}
	</div>
{/if}

<style>
	.feedback {
		position: fixed;
		top: 0; left: 0; right: 0; bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		z-index: 100;
		animation: feedback-in 0.15s ease-out;
	}

	.correct {
		background: rgba(0, 255, 136, 0.06);
	}

	.wrong {
		background: rgba(255, 45, 120, 0.08);
	}

	.icon {
		font-family: var(--font-display);
		font-size: 5rem;
		font-weight: 800;
	}

	.correct .icon {
		color: var(--correct);
		text-shadow: 0 0 40px rgba(0, 255, 136, 0.4);
	}

	.wrong .icon {
		color: var(--wrong);
		text-shadow: 0 0 40px rgba(255, 45, 120, 0.4);
	}

	.answer {
		font-family: var(--font-mono);
		font-size: 1.2rem;
		font-weight: 700;
		margin-top: 0.5rem;
		color: var(--text-primary);
		letter-spacing: 0.1em;
	}

	@keyframes feedback-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
