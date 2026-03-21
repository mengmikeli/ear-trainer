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
		if (state) fresh.settings = { ...state.settings };
		state = fresh;
		saveState(state);
		showResetConfirm = false;
	}
</script>

<div class="settings-page screen-enter">
	<h2 class="heading">SETTINGS</h2>

	{#if state}
		<div class="section">
			<span class="field-label">TONE TYPE</span>
			<div class="toggle-group">
				<button
					class="toggle-btn chromatic"
					class:active={state.settings.toneType === 'sine'}
					onclick={() => { state!.settings.toneType = 'sine'; update(); }}
				>SINE</button>
				<button
					class="toggle-btn chromatic"
					class:active={state.settings.toneType === 'piano'}
					onclick={() => { state!.settings.toneType = 'piano'; update(); }}
				>PIANO</button>
			</div>
		</div>

		<div class="section">
			<span class="field-label">DIRECTION</span>
			<div class="toggle-group">
				{#each ['ascending', 'descending', 'random'] as dir}
					<button
						class="toggle-btn chromatic"
						class:active={state.settings.direction === dir}
						onclick={() => { state!.settings.direction = dir as Direction; update(); }}
					>
						{dir.toUpperCase()}
					</button>
				{/each}
			</div>
		</div>

		<div class="section">
			<span class="field-label">SESSION LENGTH</span>
			<div class="toggle-group">
				{#each [10, 20, 30] as len}
					<button
						class="toggle-btn chromatic"
						class:active={state.settings.sessionLength === len}
						onclick={() => { state!.settings.sessionLength = len as SessionLength; update(); }}
					>
						{len}
					</button>
				{/each}
			</div>
		</div>

		<div class="section danger-section">
			{#if showResetConfirm}
				<p class="warn-text">ERASE ALL PROGRESS?</p>
				<div class="toggle-group">
					<button class="toggle-btn danger-btn" onclick={resetProgress}>CONFIRM RESET</button>
					<button class="toggle-btn" onclick={() => showResetConfirm = false}>CANCEL</button>
				</div>
			{:else}
				<button class="reset-btn chromatic" onclick={() => showResetConfirm = true}>
					RESET PROGRESS
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.settings-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.heading {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--accent);
		text-transform: uppercase;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--accent);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.field-label {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		color: var(--text-secondary);
	}

	.toggle-group {
		display: flex;
		gap: 0.5rem;
	}

	.toggle-btn {
		flex: 1;
		padding: 0.85rem;
		background: var(--surface);
		border: 1px solid var(--border);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
		transition: all 0.15s;
	}

	.toggle-btn.active {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-dim);
	}

	.toggle-btn:hover:not(.active) {
		border-color: var(--border-heavy);
	}

	.danger-section {
		margin-top: 2rem;
	}

	.reset-btn {
		width: 100%;
		padding: 0.85rem;
		background: var(--surface);
		border: 1px solid var(--hot);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--hot);
		transition: background 0.15s;
	}

	.reset-btn:hover {
		background: var(--hot-dim);
	}

	.danger-btn {
		border-color: var(--hot) !important;
		color: var(--hot) !important;
		background: var(--hot-dim) !important;
	}

	.warn-text {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--hot);
		letter-spacing: 0.1em;
	}
</style>
