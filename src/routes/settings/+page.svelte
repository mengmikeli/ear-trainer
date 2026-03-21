<script lang="ts">
	import { onMount } from 'svelte';
	import { loadState, saveState, createDefaultState } from '$lib/state';
	import type { UserState, ToneType, Direction, SessionLength } from '$lib/types';

	let state: UserState | null = $state(null);
	let showResetConfirm = $state(false);

	onMount(() => {
		state = loadState();
	});

	function update() {
		if (state) saveState(state);
	}

	function resetProgress() {
		const fresh = createDefaultState();
		if (state) fresh.settings = state.settings; // keep settings
		state = fresh;
		saveState(state);
		showResetConfirm = false;
	}
</script>

<div class="settings-page">
	<h2 class="heading">SETTINGS</h2>
	<div class="data-readout interference">▌▌▌ SYSTEM CONFIG ▌▌▌</div>

	{#if state}
		<div class="section">
			<label class="field-label">TONE TYPE</label>
			<div class="toggle-group">
				<button class:active={state.settings.toneType === 'sine'}
					onclick={() => { state!.settings.toneType = 'sine'; update(); }}>CLEAN</button>
				<button class:active={state.settings.toneType === 'piano'}
					onclick={() => { state!.settings.toneType = 'piano'; update(); }}>AMBIENT</button>
			</div>
		</div>

		<div class="section">
			<label class="field-label">DIRECTION</label>
			<div class="toggle-group">
				{#each ['ascending', 'descending', 'random'] as dir}
					<button class:active={state.settings.direction === dir}
						onclick={() => { state!.settings.direction = dir as Direction; update(); }}>
						{dir.toUpperCase()}
					</button>
				{/each}
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
			{#if showResetConfirm}
				<p class="warn">This will erase all progress. Are you sure?</p>
				<div class="toggle-group">
					<button class="reset-yes" onclick={resetProgress}>RESET</button>
					<button onclick={() => showResetConfirm = false}>CANCEL</button>
				</div>
			{:else}
				<button class="reset-btn" onclick={() => showResetConfirm = true}>
					RESET PROGRESS
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.settings-page { display: flex; flex-direction: column; gap: 1.5rem; }
	.data-readout {
		font-family: var(--mono); font-size: 0.55rem;
		color: var(--accent); opacity: 0.3;
		letter-spacing: 0.3em; text-align: center;
		margin-top: -0.5rem;
	}
	.heading {
		font-size: 0.85rem; font-weight: 900;
		letter-spacing: 0.12em; color: var(--accent);
		padding-bottom: 0.5rem; border-bottom: 2px solid var(--accent);
		text-transform: uppercase; font-family: var(--font-display);
	}
	.section { display: flex; flex-direction: column; gap: 0.5rem; }
	.field-label {
		font-size: 0.6rem; font-weight: 800;
		letter-spacing: 0.25em; color: var(--text-secondary);
		font-family: var(--font-display);
	}
	.toggle-group { display: flex; gap: 0.5rem; }
	.toggle-group button {
		flex: 1; padding: 0.85rem;
		background: var(--surface); border: 2px solid var(--border-heavy);
		border-radius: 0; font-size: 0.75rem;
		font-weight: 700; letter-spacing: 0.08em;
		color: var(--text-secondary);
		transition: all 0.15s;
		font-family: var(--font-display);
	}
	.toggle-group button.active {
		border-color: var(--accent); color: var(--accent);
		background: var(--accent-dim);
	}
	.danger { margin-top: 2rem; }
	.reset-btn {
		padding: 0.85rem; background: var(--surface);
		border: 2px solid var(--hot); border-radius: 0;
		color: var(--hot); font-size: 0.75rem;
		font-weight: 900; letter-spacing: 0.12em;
		font-family: var(--font-display);
	}
	.reset-yes {
		border-color: var(--hot) !important;
		color: var(--hot) !important;
		background: #ED174F15 !important;
	}
	.warn { font-size: 0.85rem; color: var(--hot); font-weight: 700; }
</style>
