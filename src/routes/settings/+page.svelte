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

	{#if state}
		<div class="section">
			<label class="field-label">TONE TYPE</label>
			<div class="toggle-group">
				<button class:active={state.settings.toneType === 'sine'}
					onclick={() => { state!.settings.toneType = 'sine'; update(); }}>SINE</button>
				<button class:active={state.settings.toneType === 'piano'}
					onclick={() => { state!.settings.toneType = 'piano'; update(); }}>PIANO</button>
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
	.heading {
		font-size: 0.8rem; font-weight: 800;
		letter-spacing: 0.2em; color: var(--text-secondary);
		padding-bottom: 0.5rem; border-bottom: 2px solid var(--border);
	}
	.section { display: flex; flex-direction: column; gap: 0.5rem; }
	.field-label {
		font-size: 0.6rem; font-weight: 800;
		letter-spacing: 0.2em; color: var(--text-secondary);
	}
	.toggle-group { display: flex; gap: 0.5rem; }
	.toggle-group button {
		flex: 1; padding: 0.85rem;
		background: var(--surface); border: 2px solid var(--border-heavy);
		border-radius: 2px; font-size: 0.75rem;
		font-weight: 700; letter-spacing: 0.08em;
		color: var(--text-secondary);
		transition: all 0.15s;
	}
	.toggle-group button.active {
		border-color: var(--accent); color: var(--accent);
		background: var(--accent-dim);
	}
	.danger { margin-top: 2rem; }
	.reset-btn {
		padding: 0.85rem; background: var(--surface);
		border: 2px solid var(--wrong); border-radius: 2px;
		color: var(--wrong); font-size: 0.75rem;
		font-weight: 800; letter-spacing: 0.12em;
	}
	.reset-yes {
		border-color: var(--wrong) !important;
		color: var(--wrong) !important;
		background: #ff335515 !important;
	}
	.warn { font-size: 0.85rem; color: var(--wrong); font-weight: 700; }
</style>
