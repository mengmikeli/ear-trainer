<script lang="ts">
	let { message, onclick }: { message: string; onclick: () => void } = $props();
</script>

<button class="ticker-banner" {onclick}>
	<span class="ticker-text">{message} &nbsp;&nbsp;&nbsp; {message} &nbsp;&nbsp;&nbsp; {message} &nbsp;&nbsp;&nbsp; {message} &nbsp;&nbsp;&nbsp; {message} &nbsp;&nbsp;&nbsp; {message} &nbsp;&nbsp;&nbsp;</span>
</button>

<style>
	.ticker-banner {
		position: fixed;
		top: env(safe-area-inset-top, 0px);
		left: 0;
		right: 0;
		z-index: 100;
		height: 24px;
		background: var(--accent);
		color: var(--base);
		font-family: var(--mono);
		font-size: 0.4rem;
		font-weight: 900;
		letter-spacing: 0.15em;
		border: none;
		cursor: pointer;
		overflow: hidden;
		white-space: nowrap;
		display: flex;
		align-items: center;
	}
	.ticker-text {
		display: inline-block;
		animation: ticker 12s linear infinite;
	}
	@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-16.67%); } }
</style>
