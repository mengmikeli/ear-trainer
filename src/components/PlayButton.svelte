<script lang="ts">
	interface Props { onplay: () => void; replaying?: boolean; playing?: boolean; }
	let { onplay, replaying = false, playing = false }: Props = $props();
</script>

<div class="play-wrapper">
	{#if playing}
		<div class="wave-ring ring-1"></div>
		<div class="wave-ring ring-2"></div>
		<div class="wave-ring ring-3"></div>
	{/if}
	<button class="play-btn" class:replay={replaying} onclick={onplay}>
		{replaying ? '[↻] REPLAY' : '[▶] PLAY'}
	</button>
</div>

<style>
	.play-wrapper {
		position: relative;
		display: flex; align-items: center; justify-content: center;
	}
	.wave-ring {
		position: absolute;
		border-radius: 50%;
		border: 1px solid var(--accent);
		animation: pulse 1.5s ease-out infinite;
		pointer-events: none;
	}
	.ring-1 { width: 160px; height: 160px; animation-delay: 0s; }
	.ring-2 { width: 200px; height: 200px; animation-delay: 0.3s; }
	.ring-3 { width: 240px; height: 240px; animation-delay: 0.6s; }
	@keyframes pulse {
		0% { opacity: 0.6; transform: scale(0.8); }
		100% { opacity: 0; transform: scale(1.2); }
	}
	.play-btn {
		position: relative; z-index: 1;
		width: 130px; height: 130px; border-radius: 50%;
		background: var(--accent); border: none;
		color: var(--base); font-size: 1rem; font-weight: 900;
		letter-spacing: 0.08em; transition: transform 0.1s, opacity 0.15s;
		font-family: var(--mono);
	}
	.play-btn:active { transform: scale(0.93); opacity: 0.9; }
	.replay {
		width: 90px; height: 90px; font-size: 0.8rem;
		background: transparent; border: 2px solid var(--accent);
		color: var(--accent);
	}
	.replay:active { background: var(--accent-dim); }
</style>
