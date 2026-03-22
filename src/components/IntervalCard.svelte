<script lang="ts">
	import type { IntervalDef, IntervalState, PlayMode } from '$lib/types';
	import { getMasteryLevel, isModeMastered } from '$lib/mastery';

	interface Props {
		def: IntervalDef;
		state: IntervalState;
		modeFilter?: PlayMode | null;
		ontoggle?: (id: string) => void;
		onplay?: (id: string) => void;
		playing?: boolean;
	}
	let { def, state: istate, modeFilter = null, ontoggle, onplay, playing = false }: Props = $props();

	// When filtering by mode, show that mode's stats; otherwise aggregate
	const filteredAttempts = $derived(modeFilter ? istate.modes[modeFilter].attempts : istate.attempts);
	const filteredCorrect = $derived(modeFilter ? istate.modes[modeFilter].correct : istate.correct);
	const accuracy = $derived(filteredAttempts > 0 ? Math.round((filteredCorrect / filteredAttempts) * 100) : 0);

	// Mastery: in mode view show single-mode mastery; in ALL view show overall level
	const mastery = $derived(getMasteryLevel(istate));
	const modeMastered = $derived(modeFilter ? isModeMastered(istate.modes[modeFilter]) : false);

	// In ALL view: show gold/silver/bronze dots. In mode view: show single dot if mastered
	const masteryDots = $derived(() => {
		if (modeFilter) return modeMastered ? '●' : '';
		return mastery === 'gold' ? '●●●' : mastery === 'silver' ? '●●' : mastery === 'bronze' ? '●' : '';
	});
	const masteryColor = $derived(() => {
		if (modeFilter) return modeMastered ? '#C2FE0C' : '';
		return mastery === 'gold' ? '#FFD700' : mastery === 'silver' ? '#C0C0C0' : '#CD7F32';
	});

	let pendingFlip = $state(false);
	let pressed = $state(false);
	const isOff = $derived(pressed || pendingFlip ? istate.enabled : !istate.enabled);

	function handleToggle() {
		if (!ontoggle) return;
		pendingFlip = true;
		pressed = false;
		requestAnimationFrame(() => {
			ontoggle(def.id);
			pendingFlip = false;
		});
	}
</script>

<div class="card" class:locked={!istate.unlocked} class:disabled={istate.unlocked && !istate.enabled} class:playing
	onclick={() => { if (istate.unlocked && onplay) onplay(def.id); }}
	role={istate.unlocked && onplay ? 'button' : undefined}
	tabindex={istate.unlocked && onplay ? 0 : undefined}
>
	<div class="card-fill" style="width: {istate.unlocked && istate.enabled ? accuracy : 0}%"></div>
	<div class="card-content">
		<div class="id">
			{istate.unlocked ? def.id : 'NA'}
			{#if masteryDots()}
				<span class="mastery-dots" style="color: {masteryColor()}">{masteryDots()}</span>
			{/if}
		</div>
		<div class="info">
			<div class="name">{def.name}</div>
			{#if istate.unlocked && filteredAttempts === 0}
				<div class="stats new">NEW</div>
			{:else if istate.unlocked}
				<div class="stats"><span class="stat-tag">ACC</span><span class="stat-value">{accuracy}%</span><span class="stat-tag">ATT</span><span class="stat-value">{filteredAttempts}</span></div>
			{:else}
				<div class="stats"><span class="tier-tag">T{def.tier}</span> LOCKED</div>
			{/if}
		</div>
		{#if istate.unlocked && ontoggle}
			<button class="toggle" class:toggle-off={isOff}
				onpointerdown={(e) => { e.stopPropagation(); pressed = true; }}
				onpointerup={() => pressed = false}
				onpointerleave={() => pressed = false}
				onclick={(e) => { e.stopPropagation(); handleToggle(); }}>
				{isOff ? 'OFF' : 'ON'}
			</button>
		{:else if istate.unlocked}
			<div class="acc-value">{istate.attempts > 0 ? `${accuracy}%` : '—'}</div>
		{/if}
	</div>
</div>

<style>
	.card {
		position: relative; overflow: hidden;
		background: var(--surface);
		border-left: 3px solid var(--accent);
		border-radius: 0;
		cursor: pointer;
		transition: border-left-color 0.15s;
	}
	.card.playing {
		border-left-color: var(--marathon-blue);
	}
	.card-fill {
		position: absolute; top: 0; left: 0; bottom: 0;
		background: var(--accent);
		opacity: 0.12;
		transition: width 0.35s ease-out;
	}
	.card-content {
		position: relative; z-index: 1;
		display: grid; grid-template-columns: 3.5rem 1fr auto;
		align-items: center; gap: 0.75rem; padding: 0.85rem;
	}
	.locked { opacity: 0.4; border-left-color: var(--hot); }
	.disabled { opacity: 0.55; border-left-color: var(--hot); transition: opacity 0.3s ease 0.3s; }
	.disabled .id { color: var(--hot); }
	.disabled .name { color: var(--text-secondary); }
	.disabled .toggle { opacity: calc(1 / 0.55); }
	.id {
		font-size: 2rem; font-weight: 900;
		font-family: 'BPdots', 'JetBrains Mono', monospace; text-align: center;
		color: var(--accent);
		line-height: 1;
		transform: translateY(-5px);
	}
	.locked .id { color: var(--hot); font-size: 2rem; }
	.mastery-dots {
		display: block;
		font-size: 0.5rem;
		line-height: 1;
		letter-spacing: 0.1em;
		margin-top: 2px;
	}
	.name { font-weight: 400; font-size: 0.85rem; letter-spacing: 0.02em; font-family: var(--font-display); }
	.stats { font-size: 0.4rem; color: var(--text-secondary); font-weight: 600; font-family: var(--mono); display: flex; align-items: center; gap: 2px; }
	.stat-tag {
		display: inline-flex; align-items: center;
		border: 1px solid var(--accent); padding: 0 6px;
		font-size: 0.4rem; font-family: var(--mono);
		color: var(--accent); font-weight: 900;
		white-space: nowrap; line-height: 1.6;
	}
	.stat-value {
		display: inline-flex; align-items: center;
		font-size: 0.4rem; font-family: var(--mono);
		color: var(--text-primary); font-weight: 900;
		padding: 0 8px 0 4px;
		white-space: nowrap; line-height: 1.6;
	}
	.new { color: var(--accent); font-weight: 900; letter-spacing: 0.2em; }
	.tier-tag {
		display: inline-flex; align-items: center;
		border: 1px solid var(--hot); padding: 0 4px;
		font-size: 0.35rem; font-family: var(--mono);
		color: var(--hot); margin-right: 4px;
	}
	.acc-value {
		font-size: 0.7rem; font-weight: 900;
		font-family: var(--mono); color: var(--text-primary);
		letter-spacing: -0.02em;
	}
	.toggle {
		font-family: var(--mono); font-size: 0.45rem; font-weight: 900;
		letter-spacing: 0.05em; padding: 0.3rem 0.5rem;
		border: 1px solid var(--marathon-blue); background: var(--surface);
		color: var(--marathon-blue); cursor: pointer;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
		display: inline-flex; align-items: center; justify-content: center;
		line-height: 1;
		width: 2.8rem; height: 1.4rem;
		box-sizing: border-box;
	}
	.toggle-off {
		border-color: var(--hot); background: #ED174F10;
		color: var(--hot);
	}
</style>
