<script lang="ts">
	interface Props { onplay: () => void; replaying?: boolean; }
	let { onplay, replaying = false }: Props = $props();
</script>

<button class="play-btn" class:replay={replaying} onclick={onplay}>
	{replaying ? '↻ REPLAY' : '▶ PLAY'}
</button>

<style>
	.play-btn {
		width: 120px; height: 120px; border-radius: 50%;
		background: var(--surface); border: 2px solid var(--accent);
		color: var(--accent); font-size: 1rem; font-weight: 700;
		letter-spacing: 0.05em; transition: background 0.15s, transform 0.1s;
	}
	.play-btn:active { transform: scale(0.95); }
	.replay {
		width: 80px; height: 80px; font-size: 0.8rem;
		border-color: var(--text-secondary); color: var(--text-secondary);
	}
</style>
