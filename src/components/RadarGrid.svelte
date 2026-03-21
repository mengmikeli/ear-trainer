<script lang="ts">
	interface Props {
		size?: string;
	}
	let { size = '100%' }: Props = $props();

	const cx = 200;
	const cy = 200;
	const radii = [30, 60, 100, 140, 190, 200];
	const outerR = 200;
	const tickExtend = 10;
	const lineCount = 12;
	const angleStep = 360 / lineCount;
</script>

<div class="radar-wrapper" style:width={size} style:height={size}>
	<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
		<!-- Concentric circles -->
		{#each radii as r}
			<circle {cx} {cy} {r} fill="none" />
		{/each}

		<!-- 12 radial lines (every 30°) -->
		{#each Array(lineCount) as _, i}
			{@const angle = (i * angleStep * Math.PI) / 180}
			<line
				x1={cx}
				y1={cy}
				x2={cx + outerR * Math.cos(angle)}
				y2={cy + outerR * Math.sin(angle)}
			/>
		{/each}

		<!-- Crosshair tick marks at N/S/E/W -->
		<!-- North (up) -->
		<line x1={cx} y1={cy - outerR} x2={cx} y2={cy - outerR - tickExtend} />
		<!-- South (down) -->
		<line x1={cx} y1={cy + outerR} x2={cx} y2={cy + outerR + tickExtend} />
		<!-- East (right) -->
		<line x1={cx + outerR} y1={cy} x2={cx + outerR + tickExtend} y2={cy} />
		<!-- West (left) -->
		<line x1={cx - outerR} y1={cy} x2={cx - outerR - tickExtend} y2={cy} />
	</svg>
</div>

<style>
	.radar-wrapper {
		position: absolute;
		pointer-events: none;
		z-index: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: rotate 120s linear infinite;
	}

	svg {
		width: 100%;
		height: 100%;
	}

	svg :global(circle),
	svg :global(line) {
		stroke: var(--marathon-blue, #3a2cff);
		stroke-opacity: 0.35;
		stroke-width: 0.5;
	}

	@keyframes rotate {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
