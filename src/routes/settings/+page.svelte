<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { base } from '$app/paths';
	import { loadStateV4, saveStateV4 } from '$lib/state/storage';
	import { createDefaultStateV4 } from '$lib/state/defaults';
	import type { UserStateV4 } from '$lib/state/schema';
	import type { ToneType, SessionLength, ThemeMode } from '$lib/state/schema';
	import { applyTheme, watchSystemTheme } from '$lib/theme';
	import { playInterval } from '$lib/audio/playback';
	import { APP_VERSION, VERSION_STRING, RELEASE_NOTES } from '$lib/version';
	import LongPressButton from '../../components/LongPressButton.svelte';

	let showReleaseNotes = $state(false);
	let versionCopied = $state(false);

	let state: UserStateV4 | null = $state(null);
	const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
	let systemThemeCleanup: (() => void) | undefined;

	onMount(() => {
		state = loadStateV4();
		if (state) {
			systemThemeCleanup = watchSystemTheme(state.settings.theme, () => applyTheme('system'));
		}
	});

	onDestroy(() => {
		systemThemeCleanup?.();
	});

	function update() {
		if (state) saveStateV4(state);
	}

	function previewTone(tone: ToneType) {
		if (!state) return;
		state.settings.toneType = tone;
		update();
		playInterval(60, 7, 'ascending', tone);
	}

	function executeReset() {
		const fresh = createDefaultStateV4();
		if (state) fresh.settings = state.settings;
		state = fresh;
		saveStateV4(state);
	}
</script>

<div class="settings-page">
	<h2 class="heading">SETTINGS</h2>

	{#if state}
		<div class="section">
			<label class="field-label">THEME</label>
			<div class="toggle-group">
				{#each ['dark', 'light', 'system'] as t}
					<button class:active={state.settings.theme === t}
						onclick={() => {
							state!.settings.theme = t as ThemeMode;
							applyTheme(t as ThemeMode);
							systemThemeCleanup?.();
							systemThemeCleanup = watchSystemTheme(t as ThemeMode, () => applyTheme('system'));
							update();
						}}>
						{t.toUpperCase()}
					</button>
				{/each}
			</div>
		</div>

		<div class="section">
			<label class="field-label">TONE TYPE</label>
			<div class="toggle-group">
				<button class:active={state.settings.toneType === 'epiano'}
					onclick={() => previewTone('epiano')}>WARM</button>
				<button class:active={state.settings.toneType === 'sine'}
					onclick={() => previewTone('sine')}>CLEAN</button>
				<button class:active={state.settings.toneType === 'piano'}
					onclick={() => previewTone('piano')}>AMBIENT</button>
			</div>
		</div>

		<div class="section">
			<label class="field-label">PLAY MODES</label>
			<div class="toggle-group">
				<button class:active={state.settings.enabledModes.ascending}
					onclick={() => {
						const m = state!.settings.enabledModes;
						const activeCount = +m.ascending + +m.descending + +m.harmonic;
						if (m.ascending && activeCount <= 1) return;
						m.ascending = !m.ascending;
						update();
					}}>{'\uE007'} ASC</button>
				<button class:active={state.settings.enabledModes.descending}
					onclick={() => {
						const m = state!.settings.enabledModes;
						const activeCount = +m.ascending + +m.descending + +m.harmonic;
						if (m.descending && activeCount <= 1) return;
						m.descending = !m.descending;
						update();
					}}>{'\uE008'} DESC</button>
				<button class:active={state.settings.enabledModes.harmonic}
					onclick={() => {
						const m = state!.settings.enabledModes;
						const activeCount = +m.ascending + +m.descending + +m.harmonic;
						if (m.harmonic && activeCount <= 1) return;
						m.harmonic = !m.harmonic;
						update();
					}}>{'\uE000'} HARM</button>
			</div>
		</div>

		<div class="section">
			<label class="field-label">CHORD VOICINGS</label>
			<div class="toggle-group">
				<button class:active={state.settings.enabledVoicings.root}
					onclick={() => {
						const v = state!.settings.enabledVoicings;
						const activeCount = +v.root + +v.first + +v.second;
						if (v.root && activeCount <= 1) return;
						v.root = !v.root;
						update();
					}}>ROOT</button>
				<button class:active={state.settings.enabledVoicings.first}
					onclick={() => {
						const v = state!.settings.enabledVoicings;
						const activeCount = +v.root + +v.first + +v.second;
						if (v.first && activeCount <= 1) return;
						v.first = !v.first;
						update();
					}}>INV1</button>
				<button class:active={state.settings.enabledVoicings.second}
					onclick={() => {
						const v = state!.settings.enabledVoicings;
						const activeCount = +v.root + +v.first + +v.second;
						if (v.second && activeCount <= 1) return;
						v.second = !v.second;
						update();
					}}>INV2</button>
			</div>
		</div>

		<div class="section">
			<label class="field-label">SESSION LENGTH</label>
			<div class="toggle-group">
				{#each [10, 20, 30] as len}
					<button class:active={state.settings.sessionLength === len}
						onclick={() => { state!.settings.sessionLength = len as SessionLength; update(); }}>
						{len}
					</button>
				{/each}
			</div>
		</div>

		<div class="section danger">
			<label class="field-label">DANGER ZONE</label>

			<div class="dev-toggle-row">
				<span class="dev-label">DEV MODE</span>
				<button class="dev-btn" class:active={state.settings.devMode}
					onclick={() => {
						state!.settings.devMode = !state!.settings.devMode;
						update();
					}}>
					{state.settings.devMode ? 'ON' : 'OFF'}
				</button>
			</div>

			{#if state.settings.devMode}
			<div class="dev-toggle-row">
				<span class="dev-label" style="color: var(--marathon-blue)">SUPERCHARGE VIZ</span>
				<button class="dev-btn supercharge" class:active={state.settings.superchargeViz ?? !isMobile}
					onclick={() => {
						state!.settings.superchargeViz = !(state!.settings.superchargeViz ?? !isMobile);
						update();
					}}>
					{(state.settings.superchargeViz ?? !isMobile) ? 'ON' : 'OFF'}
				</button>
			</div>
				<LongPressButton
					label="ENTER VIZ LAB"
					doneLabel={'\uE018 VIZ LAB \uE018'}
					color="accent"
					onExecute={() => {
						setTimeout(() => { window.location.href = `${base}/lab`; }, 500);
					}}
				/>

				<LongPressButton
					label="ENTER TRAINING"
					doneLabel={'\uE018 TRAIN \uE018'}
					color="marathon-blue"
					onExecute={() => {
						setTimeout(() => { window.location.href = `${base}/quiz`; }, 500);
					}}
				/>

				<LongPressButton
					label="ENTER ONBOARDING"
					doneLabel={'\uE018 ONBOARD \uE018'}
					color="marathon-blue"
					onExecute={() => {
						if (state) {
							state.settings.hasCompletedFRE = false;
							saveStateV4(state);
						}
						setTimeout(() => { window.location.href = `${base}/welcome`; }, 500);
					}}
				/>

			{/if}

			<LongPressButton
				label="RESET PROGRESS"
				doneLabel={'\uE018 RESET \uE018'}
				duration={3500}
				color="danger"
				onExecute={executeReset}
			/>
		</div>

		<div class="section version-section">
			<label class="field-label">ABOUT</label>
			<div class="version-row">
				<button class="version-copy" onclick={(e) => {
					e.stopPropagation();
					navigator.clipboard.writeText(VERSION_STRING);
					versionCopied = true;
					setTimeout(() => { versionCopied = false; }, 1500);
				}}>
					<span class="version-label" class:copied={versionCopied}>{VERSION_STRING}</span>
				</button>
				<button class="version-btn" onclick={() => showReleaseNotes = !showReleaseNotes}>
					<span class="version-toggle" class:open={showReleaseNotes}>{showReleaseNotes ? '^' : '>'}</span>
				</button>
			</div>

			{#if showReleaseNotes}
				<div class="release-notes">
					{#each RELEASE_NOTES as note}
						<div class="release">
							<div class="release-header">
								<span class="release-version">v{note.version}</span>
								<span class="release-date">{note.date}</span>
							</div>
							<div class="release-title">{note.title}</div>
							<ul class="release-changes">
								{#each note.changes as change}
									<li>{change}</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			{/if}

			<div class="credits">
				<div class="credits-header">TEAM</div>
				<div class="credits-grid">
					<div class="credit-entry">
						<span class="credit-emoji">{'\uE014'}</span>
						<div class="credit-info">
							<span class="credit-name">MIKE</span>
							<span class="credit-role">Creator / The Only Human</span>
						</div>
					</div>
					<div class="credit-entry">
						<span class="credit-emoji">{'\uE015'}</span>
						<div class="credit-info">
							<span class="credit-name">MOTO</span>
							<span class="credit-role">Lead / Architecture / Sprint Ops</span>
						</div>
					</div>
					<div class="credit-entry">
						<span class="credit-emoji">{'\uE002'}</span>
						<div class="credit-info">
							<span class="credit-name">PIXI</span>
							<span class="credit-role">Design / Learning Systems / UI</span>
						</div>
					</div>
					<div class="credit-entry">
						<span class="credit-emoji">{'\uE000'}</span>
						<div class="credit-info">
							<span class="credit-name">NOKI</span>
							<span class="credit-role">Visualization / Chladni / Lissajous</span>
						</div>
					</div>
					<div class="credit-entry">
						<span class="credit-emoji">{'\uE013'}</span>
						<div class="credit-info">
							<span class="credit-name">PALM</span>
							<span class="credit-role">QA / Testing / Visual Regression</span>
						</div>
					</div>
				</div>
				<div class="credits-footer">
					Built with <span class="credits-accent">OpenClaw</span> / Human-directed, agent-built
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.settings-page { display: flex; flex-direction: column; gap: 1.5rem; }
	.heading {
		font-size: 3rem; font-weight: 400;
		letter-spacing: 0.12em; color: var(--text-primary);
		padding-bottom: 0.5rem; border-bottom: 2px solid var(--border-heavy);
		text-transform: uppercase; font-family: var(--font-display);
	}
	.section { display: flex; flex-direction: column; gap: 0.5rem; }
	.field-label {
		font-size: 0.6rem; font-weight: 400;
		letter-spacing: 0.25em; color: var(--text-primary);
		font-family: var(--font-display);
	}
	.toggle-group { display: flex; gap: 0.5rem; }
	.toggle-group button {
		flex: 1; padding: 0.85rem;
		background: var(--surface); border: 1px solid var(--border-heavy);
		border-radius: 0; font-size: 0.45rem;
		font-weight: 400; letter-spacing: 0.08em;
		color: var(--text-secondary);
		transition: all 0.15s;
		font-family: var(--mono);
	}
	.toggle-group button.active {
		border-color: var(--marathon-blue); color: var(--marathon-blue);
		background: #3A2CFF10;
	}
	.danger { margin-top: 2rem; }
	.dev-toggle-row {
		display: flex; align-items: center; justify-content: space-between;
		padding: 0.6rem 0.85rem;
		background: var(--surface);
		border: 1px solid var(--border);
		margin-bottom: 0.5rem;
	}
	.dev-label {
		font-family: var(--mono); font-size: 0.45rem;
		font-weight: 900; letter-spacing: 0.1em;
		color: var(--hot);
	}
	.dev-btn {
		font-family: var(--mono); font-size: 0.4rem;
		font-weight: 900; letter-spacing: 0.08em;
		padding: 0.25rem 0.6rem;
		border: 1px solid var(--hot);
		background: transparent;
		color: var(--hot);
		cursor: pointer;
	}
	.dev-btn.active {
		background: var(--hot);
		color: var(--base);
	}
	.dev-btn.supercharge {
		border-color: var(--marathon-blue);
		color: var(--marathon-blue);
	}
	.dev-btn.supercharge.active {
		background: var(--marathon-blue);
		color: var(--base);
	}

	/* Version + Release Notes */
	.version-section { margin-top: 1rem; }
	.version-row {
		display: flex; gap: 0;
	}
	.version-copy {
		flex: 1;
		display: flex; align-items: center;
		padding: 0.6rem 0.85rem;
		background: var(--surface); border: 1px solid var(--border);
		border-right: none;
		color: var(--text-secondary); font-size: 0.45rem;
		font-family: var(--mono); letter-spacing: 0.08em;
		cursor: pointer;
		transition: color 0.15s;
	}
	.version-copy:active { color: var(--accent); }
	.version-btn {
		display: flex; align-items: center; justify-content: center;
		padding: 0.6rem 0.85rem;
		background: var(--surface); border: 1px solid var(--border);
		color: var(--text-secondary); font-size: 0.45rem;
		font-family: var(--mono); letter-spacing: 0.08em;
		cursor: pointer;
	}
	.version-label { color: var(--marathon-blue); transition: color 0.15s; }
	.version-label.copied { color: var(--correct); }
	.version-toggle { font-size: 0.45rem; display: inline-block; transition: transform 0.15s; }
	.version-toggle.open { transform: rotate(180deg); }
	.release-notes {
		display: flex; flex-direction: column; gap: 1rem;
		margin-top: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		background: var(--surface);
	}
	.release { }
	.release-header {
		display: flex; justify-content: space-between; align-items: center;
		margin-bottom: 0.25rem;
	}
	.release-version {
		font-family: var(--mono); font-size: 0.5rem;
		color: var(--accent); font-weight: 700;
	}
	.release-date {
		font-family: var(--mono); font-size: 0.4rem;
		color: var(--text-secondary);
	}
	.release-title {
		font-family: var(--font-display); font-size: 0.7rem;
		color: var(--text-primary); letter-spacing: 0.1em;
		margin-bottom: 0.35rem;
	}
	.release-changes {
		list-style: none; padding: 0;
		display: flex; flex-direction: column; gap: 0.2rem;
	}
	.release-changes li {
		font-family: var(--mono); font-size: 0.35rem;
		color: var(--text-secondary); line-height: 1.5;
		padding-left: 0.75rem;
		position: relative;
	}
	.release-changes li::before {
		content: '›';
		position: absolute; left: 0;
		color: var(--border-heavy);
	}
	.release + .release {
		border-top: 1px solid var(--border);
		padding-top: 1rem;
	}

	/* Credits */
	.credits {
		margin-top: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		background: var(--surface);
		display: flex; flex-direction: column; gap: 0.75rem;
	}
	.credits-header {
		font-family: var(--font-display); font-size: 0.6rem;
		letter-spacing: 0.25em; color: var(--text-secondary);
	}
	.credits-grid {
		display: flex; flex-direction: column; gap: 0.5rem;
	}
	.credit-entry {
		display: flex; align-items: center; gap: 0.6rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--border);
	}
	.credit-entry:last-child { border-bottom: none; }
	.credit-emoji { font-size: 0.8rem; width: 1.2rem; text-align: center; }
	.credit-info {
		display: flex; flex-direction: column; gap: 0.1rem;
	}
	.credit-name {
		font-family: var(--font-display); font-size: 0.55rem;
		letter-spacing: 0.15em; color: var(--text-primary);
		font-weight: 700;
	}
	.credit-role {
		font-family: var(--mono); font-size: 0.35rem;
		letter-spacing: 0.06em; color: var(--text-secondary);
	}
	.credits-footer {
		font-family: var(--mono); font-size: 0.3rem;
		letter-spacing: 0.08em; color: var(--text-secondary);
		text-align: center; padding-top: 0.25rem;
		border-top: 1px solid var(--border);
	}
	.credits-accent { color: var(--marathon-blue); }

	/* Desktop: larger type (width controlled by layout shell) */
	@media (min-width: 768px) {
		.heading { font-size: 3.5rem; }
		.credits-grid {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 0.5rem;
		}
	}
</style>
