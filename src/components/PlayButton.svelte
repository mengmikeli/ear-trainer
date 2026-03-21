<script lang="ts">
	interface Props { onplay: () => void; replaying?: boolean; }
	let { onplay, replaying = false }: Props = $props();
</script>

<button class="play-btn chromatic" class:replay={replaying} onclick={onplay}>
	<span class="icon">{replaying ? '↻' : '▶'}</span>
	<span class="text">{replaying ? 'REPLAY' : 'PLAY'}</span>
</button>

<style>
	.play-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		width: 130px;
		height: 130px;
		border-radius: 50%;
		background: var(--accent);
		border: none;
		transition: transform 0.1s, box-shadow 0.15s;
		box-shadow: 0 0 30px rgba(0, 212, 255, 0.15);
	}

	.play-btn:hover {
		box-shadow: 0 0 50px rgba(0, 212, 255, 0.25);
	}

	.play-btn:active {
		transform: scale(0.93);
	}

	.icon {
		font-size: 1.4rem;
		color: var(--base);
	}

	.text {
		font-family: var(--font-display);
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--base);
		letter-spacing: 0.12em;
	}

	.replay {
		width: 90px;
		height: 90px;
		background: transparent;
		border: 1px solid var(--accent);
		box-shadow: none;
	}

	.replay .icon {
		font-size: 1.1rem;
		color: var(--accent);
	}

	.replay .text {
		font-size: 0.65rem;
		color: var(--accent);
	}

	.replay:hover {
		background: var(--accent-dim);
		box-shadow: 0 0 20px rgba(0, 212, 255, 0.1);
	}

	.replay:active {
		background: var(--accent-dim);
	}
</style>
