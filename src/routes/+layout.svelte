<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import BottomNav from '../components/BottomNav.svelte';
	import TickerBanner from '../components/TickerBanner.svelte';
	import { initTheme } from '$lib/theme';
	import { loadStateV4 } from '$lib/state/storage';
	import { warmUpAudio } from '$lib/audio/context';
	import { releaseAudioSession } from '$lib/audio/session';

	let { children } = $props();

	let showUpdate = $state(false);

	function applyUpdate() {
		showUpdate = false;
		// Tell the waiting SW to activate, then reload to pick up new assets
		navigator.serviceWorker?.getRegistration().then((reg) => {
			if (reg?.waiting) {
				reg.waiting.postMessage({ type: 'SKIP_WAITING' });
				// Reload once the new SW takes over
				navigator.serviceWorker.addEventListener('controllerchange', () => {
					window.location.reload();
				}, { once: true });
			} else {
				window.location.reload();
			}
		});
	}

	onMount(() => {
		const state = loadStateV4();
		initTheme(state.settings.theme);

		// Unlock iOS audio on first user interaction (touch or click)
		const unlock = () => {
			warmUpAudio();
			document.removeEventListener('touchend', unlock);
			document.removeEventListener('click', unlock);
		};
		document.addEventListener('touchend', unlock, { once: true });
		document.addEventListener('click', unlock, { once: true });

		// Release audio session when going to background.
		// Recovery on foreground is handled by individual pages (QuizSession
		// resets context + shows reconnect banner on every resume).
		function handleVisibility() {
			if (document.hidden) {
				releaseAudioSession();
			}
		}
		document.addEventListener('visibilitychange', handleVisibility);

		// Detect service worker updates — show prompt instead of auto-reloading
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.getRegistration().then((reg) => {
				if (!reg) return;
				// If a new SW is already waiting (installed while tab was open)
				if (reg.waiting) {
					showUpdate = true;
				}
				// Watch for future updates
				reg.addEventListener('updatefound', () => {
					const newSw = reg.installing;
					if (!newSw) return;
					newSw.addEventListener('statechange', () => {
						if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
							showUpdate = true;
						}
					});
				});
			});
		}

		return () => {
			document.removeEventListener('visibilitychange', handleVisibility);
		};
	});
</script>

<div class="app scanlines">
	{#if showUpdate}
		<TickerBanner message="UPDATE AVAILABLE — TAP TO RELOAD" onclick={applyUpdate} />
	{/if}
	<main class="content">
		{@render children()}
	</main>
	<BottomNav />
</div>

<style>
	.app {
		position: relative;
		display: flex; flex-direction: column; height: 100dvh;
		max-width: 480px; margin: 0 auto;
		padding-top: env(safe-area-inset-top);
	}
	.content {
		flex: 1; overflow-y: auto; padding: 1.5rem 1.25rem;
	}
	.update-bar {
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
	@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }

	/* Desktop: wider container, more breathing room */
	@media (min-width: 768px) {
		.app {
			max-width: 960px;
		}
		.content {
			padding: 2rem 2.5rem;
		}
	}
</style>
