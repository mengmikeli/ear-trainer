<script lang="ts">
	interface Props { onplay: () => void; replaying?: boolean; }
	let { onplay, replaying = false }: Props = $props();
</script>

<button class="play-btn" class:replay={replaying} onclick={onplay}>
	{replaying ? '↻ REPLAY' : '▶ PLAY'}
</button>

<style>
	.play-btn {
		width: 130px; height: 130px; border-radius: 50%;
		background: var(--accent); border: 3px solid var(--accent);
		color: var(--base); font-size: 1.1rem; font-weight: 800;
		letter-spacing: 0.08em; transition: transform 0.1s, opacity 0.15s;
	}
	.play-btn:active { transform: scale(0.93); opacity: 0.9; }
	.replay {
		width: 90px; height: 90px; font-size: 0.85rem;
		background: transparent; border: 2px solid var(--text-secondary);
		color: var(--text-secondary);
	}
	.replay:active { background: #ffffff08; }
</style>
