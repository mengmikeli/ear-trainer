<script lang="ts">
	interface Props { onplay: () => void; replaying?: boolean; playing?: boolean; }
	let { onplay, replaying = false, playing = false }: Props = $props();
</script>

<div class="play-wrapper">
	{#if playing}
		<svg class="wave-rings" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<filter id="wave-distort-1" x="-20%" y="-20%" width="140%" height="140%">
					<feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="3" seed="1">
						<animate attributeName="baseFrequency" values="0.015;0.025;0.015" dur="1.2s" repeatCount="indefinite" />
					</feTurbulence>
					<feDisplacementMap in="SourceGraphic" scale="12" />
				</filter>
				<filter id="wave-distort-2" x="-20%" y="-20%" width="140%" height="140%">
					<feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="3" seed="42">
						<animate attributeName="baseFrequency" values="0.02;0.03;0.02" dur="1.5s" repeatCount="indefinite" />
					</feTurbulence>
					<feDisplacementMap in="SourceGraphic" scale="15" />
				</filter>
				<filter id="wave-distort-3" x="-20%" y="-20%" width="140%" height="140%">
					<feTurbulence type="turbulence" baseFrequency="0.018" numOctaves="4" seed="99">
						<animate attributeName="baseFrequency" values="0.018;0.028;0.018" dur="1.8s" repeatCount="indefinite" />
					</feTurbulence>
					<feDisplacementMap in="SourceGraphic" scale="18" />
				</filter>
			</defs>
			<circle cx="150" cy="150" r="85" class="ring ring-1" filter="url(#wave-distort-1)" />
			<circle cx="150" cy="150" r="105" class="ring ring-2" filter="url(#wave-distort-2)" />
			<circle cx="150" cy="150" r="125" class="ring ring-3" filter="url(#wave-distort-3)" />
		</svg>
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
	.wave-rings {
		position: absolute;
		width: 300px; height: 300px;
		pointer-events: none;
	}
	.ring {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.5;
	}
	.ring-1 {
		opacity: 0.7;
		animation: ring-pulse 1.5s ease-out infinite;
	}
	.ring-2 {
		opacity: 0.5;
		animation: ring-pulse 1.5s ease-out infinite 0.3s;
	}
	.ring-3 {
		opacity: 0.3;
		animation: ring-pulse 1.5s ease-out infinite 0.6s;
	}
	@keyframes ring-pulse {
		0% { opacity: 0.7; transform-origin: center; transform: scale(0.85); }
		100% { opacity: 0; transform-origin: center; transform: scale(1.15); }
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
