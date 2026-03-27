<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import BottomNav from '../components/BottomNav.svelte';
	import { initTheme } from '$lib/theme';
	import { loadState } from '$lib/state';
	import { warmUpAudio, suspendAudio, resumeAudio, cancelScheduledSuspend } from '$lib/audio';

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
		const state = loadState();
		initTheme(state.settings.theme);

		// Unlock iOS audio on first user interaction (touch or click)
		const unlock = () => {
			warmUpAudio();
			document.removeEventListener('touchend', unlock);
			document.removeEventListener('click', unlock);
		};
		document.addEventListener('touchend', unlock, { once: true });
		document.addEventListener('click', unlock, { once: true });

		// Suspend audio when page goes to background (saves battery, clears Dynamic Island)
		// Resume audio context when returning — iOS kills suspended contexts
		function handleVisibility() {
			if (document.hidden) {
				cancelScheduledSuspend();
				suspendAudio();
			} else {
				// Try to resume the AudioContext; if iOS blocks it (no gesture),
				// the next user tap → play → getContext() will handle it
				resumeAudio();
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
		<button class="update-bar" onclick={applyUpdate}>
			UPDATE AVAILABLE — TAP TO RELOAD
		</button>
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
		width: 100%;
		padding: 0.5rem;
		background: var(--accent);
		color: var(--base);
		font-family: var(--mono);
		font-size: 0.4rem;
		font-weight: 900;
		letter-spacing: 0.15em;
		text-align: center;
		border: none;
		cursor: pointer;
	}
</style>
