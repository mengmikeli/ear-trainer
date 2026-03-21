<script lang="ts">
	interface Props { size?: string; }
	let { size = '100%' }: Props = $props();

	const cx = 200;
	const cy = 200;
	const radii = [30, 60, 100, 140, 190, 200];
	const outerR = 200;
	const tickExtend = 10;
	const lineCount = 12;
	const angleStep = 360 / lineCount;

	const stroke = '#3A2CFF';
	const opacity = '0.4';
	const sw = '1';
</script>

<div class="radar-wrapper" style:width={size} style:height={size}>
	<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
		{#each radii as r}
			<circle {cx} {cy} {r} fill="none" {stroke} stroke-opacity={opacity} stroke-width={sw} />
		{/each}

		{#each Array(lineCount) as _, i}
			{@const angle = (i * angleStep * Math.PI) / 180}
			<line
				x1={cx} y1={cy}
				x2={cx + outerR * Math.cos(angle)}
				y2={cy + outerR * Math.sin(angle)}
				{stroke} stroke-opacity={opacity} stroke-width={sw}
			/>
		{/each}

		<line x1={cx} y1={cy - outerR} x2={cx} y2={cy - outerR - tickExtend} {stroke} stroke-opacity={opacity} stroke-width={sw} />
		<line x1={cx} y1={cy + outerR} x2={cx} y2={cy + outerR + tickExtend} {stroke} stroke-opacity={opacity} stroke-width={sw} />
		<line x1={cx + outerR} y1={cy} x2={cx + outerR + tickExtend} y2={cy} {stroke} stroke-opacity={opacity} stroke-width={sw} />
		<line x1={cx - outerR} y1={cy} x2={cx - outerR - tickExtend} y2={cy} {stroke} stroke-opacity={opacity} stroke-width={sw} />
	</svg>
</div>

<style>
	.radar-wrapper {
		position: absolute;
		inset: 0;
		margin: auto;
		pointer-events: none;
		z-index: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: rotate 120s linear infinite;
	}
	svg { width: 100%; height: 100%; }

	@keyframes rotate {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>
