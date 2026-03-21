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
	.ring-1 { width: 170px; height: 170px; animation-delay: 0s; }
	.ring-2 { width: 210px; height: 210px; animation-delay: 0.3s; }
	.ring-3 { width: 250px; height: 250px; animation-delay: 0.6s; }
	@keyframes pulse {
		0% { opacity: 0.6; transform: scale(0.8); }
		100% { opacity: 0; transform: scale(1.2); }
	}
	.play-btn {
		position: relative; z-index: 1;
		width: 140px; height: 140px; border-radius: 50%;
		background: var(--accent); border: none;
		color: var(--base); font-size: 0.9rem; font-weight: 900;
		letter-spacing: 0.05em; transition: transform 0.1s, opacity 0.15s;
		font-family: var(--mono);
		display: flex; align-items: center; justify-content: center;
		text-align: center; line-height: 1;
	}
	.play-btn:active { transform: scale(0.93); opacity: 0.9; }
	.replay {
		width: 100px; height: 100px; font-size: 0.75rem;
		background: transparent; border: 2px solid var(--accent);
		color: var(--accent);
	}
	.replay:active { background: var(--accent-dim); }
</style>
