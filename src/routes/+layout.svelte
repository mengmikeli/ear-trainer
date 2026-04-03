<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import '../app.css';
	import BottomNav from '../components/BottomNav.svelte';
	import SideNav from '../components/SideNav.svelte';
	import TickerBanner from '../components/TickerBanner.svelte';
	import { initTheme } from '$lib/theme';
	import { loadStateV4 } from '$lib/state/storage';
	import { warmUpAudio } from '$lib/audio/context';
	import { releaseAudioSession } from '$lib/audio/session';

	let { children } = $props();

	let showUpdate = $state(false);

	// Home page: hide nav entirely (GO is the only action)
	const isHome = $derived(() => {
		const path = page.url?.pathname ?? '/';
		const homePath = base || '/';
		return path === homePath || path === homePath + '/';
	});

	// Onboarding: show nav but disabled (visual presence, no function)
	const isOnboarding = $derived(() => {
		const path = page.url?.pathname ?? '/';
		return path.includes('/welcome');
	});

	// Hide nav on home, disable nav during onboarding
	const disableNav = $derived(() => isOnboarding());

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
		// Delay before showing banner to avoid flash on fresh loads
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.getRegistration().then((reg) => {
				if (!reg) return;

				function showUpdateBanner() {
					// Don't show on home page or onboarding — let SW update silently
					if (isHome() || isOnboarding()) return;
					// Small delay to avoid flash when loading a just-deployed version
					setTimeout(() => { showUpdate = true; }, 3000);
				}

				// If a new SW is already waiting (installed while tab was open)
				if (reg.waiting) {
					showUpdateBanner();
				}
				// Watch for future updates
				reg.addEventListener('updatefound', () => {
					const newSw = reg.installing;
					if (!newSw) return;
					newSw.addEventListener('statechange', () => {
						if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
							showUpdateBanner();
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

<div class="app-shell">
	<!-- Desktop sidebar — disabled during onboarding -->
	<div class="sidebar-slot" class:nav-disabled={disableNav()}>
		<SideNav />
	</div>

	<div class="app-main scanlines">
		{#if showUpdate && !isHome() && !isOnboarding()}
			<TickerBanner message="UPDATE AVAILABLE -- TAP TO RELOAD" onclick={applyUpdate} />
		{/if}
		<main class="content">
			{@render children()}
		</main>
		<!-- Mobile bottom nav — disabled during onboarding -->
		<div class="bottomnav-slot" class:nav-disabled={disableNav()}>
			<BottomNav />
		</div>
	</div>
</div>

<style>
	/* ── Shell: sidebar + main ── */
	.app-shell {
		display: flex;
		height: 100dvh;
	}

	/* Sidebar hidden on mobile */
	.sidebar-slot {
		display: none;
	}

	/* ── Main column (mobile-first) ── */
	.app-main {
		position: relative;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		height: 100dvh;
		max-width: 480px;
		margin: 0 auto;
		padding-top: env(safe-area-inset-top);
	}

	.content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem 1.25rem;
	}

	.bottomnav-slot {
		display: block;
	}

	/* Onboarding: nav visible but non-interactive */
	.nav-disabled {
		pointer-events: none;
		opacity: 0.3;
	}

	/* ── Desktop (≥768px): sidebar visible, bottom nav hidden ── */
	@media (min-width: 768px) {
		.sidebar-slot {
			display: block;
		}

		.bottomnav-slot {
			display: none;
		}

		.app-main {
			max-width: none;
			/* Content centered within the main area, with breathing room */
			margin: 0;
		}

		.content {
			max-width: 720px;
			margin: 0 auto;
			width: 100%;
			padding: 2rem 2.5rem;
		}
	}

	/* ── Wide desktop (≥1200px): more space ── */
	@media (min-width: 1200px) {
		.content {
			max-width: 880px;
			padding: 2rem 3rem;
		}
	}
</style>
