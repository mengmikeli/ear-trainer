<script lang="ts">
	import type { ChordDef, ChordState, ChordVoicing } from '$lib/types';
	import { isModeMastered } from '$lib/mastery';

	interface Props {
		def: ChordDef;
		state: ChordState;
		voicingFilter?: ChordVoicing | null;
		ontoggle?: (id: string) => void;
		onplay?: (id: string) => void;
		playing?: boolean;
	}
	let { def, state: cstate, voicingFilter = null, ontoggle, onplay, playing = false }: Props = $props();

	const filteredAttempts = $derived(voicingFilter ? cstate.voicings[voicingFilter].attempts : cstate.attempts);
	const filteredCorrect = $derived(voicingFilter ? cstate.voicings[voicingFilter].correct : cstate.correct);
	const accuracy = $derived(filteredAttempts > 0 ? Math.round((filteredCorrect / filteredAttempts) * 100) : 0);

	// Mastery: count mastered voicings
	const masteredCount = $derived(
		[cstate.voicings.root, cstate.voicings.first, cstate.voicings.second]
			.filter(v => isModeMastered(v)).length
	);
	const mastery = $derived(masteredCount === 3 ? 'gold' : masteredCount === 2 ? 'silver' : masteredCount === 1 ? 'bronze' : 'none');
	const modeMastered = $derived(voicingFilter ? isModeMastered(cstate.voicings[voicingFilter]) : false);

	const masteryDots = $derived(() => {
		if (voicingFilter) return modeMastered ? '●' : '';
		return mastery === 'gold' ? '●●●' : mastery === 'silver' ? '●●' : mastery === 'bronze' ? '●' : '';
	});
	const masteryColor = $derived(() => {
		if (voicingFilter) return modeMastered ? '#C2FE0C' : '';
		return mastery === 'gold' ? '#FFD700' : mastery === 'silver' ? '#C0C0C0' : '#CD7F32';
	});

	let pendingFlip = $state(false);
	let pressed = $state(false);
	const isOff = $derived(pressed || pendingFlip ? cstate.enabled : !cstate.enabled);

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

<div class="card" class:locked={!cstate.unlocked} class:disabled={cstate.unlocked && !cstate.enabled} class:playing
	onclick={() => { if (cstate.unlocked && onplay) onplay(def.id); }}
	role={cstate.unlocked && onplay ? 'button' : undefined}
	tabindex={cstate.unlocked && onplay ? 0 : undefined}
>
	<div class="card-fill" style="width: {cstate.unlocked && cstate.enabled ? accuracy : 0}%"></div>
	<div class="card-content">
		<div class="id">
			{cstate.unlocked ? def.id.toUpperCase() : 'NA'}
			{#if masteryDots()}
				<span class="mastery-dots" style="color: {masteryColor()}">{masteryDots()}</span>
			{/if}
		</div>
		<div class="info">
			<div class="name">{def.name}</div>
			{#if cstate.unlocked && filteredAttempts === 0}
				<div class="stats new">NEW</div>
			{:else if cstate.unlocked}
				<div class="stats"><span class="stat-tag">ACC</span><span class="stat-value">{accuracy}%</span><span class="stat-tag">Q</span><span class="stat-value">{filteredAttempts}</span></div>
			{:else}
				<div class="stats"><span class="tier-tag">T{def.tier}</span> LOCKED</div>
			{/if}
		</div>
		{#if cstate.unlocked && ontoggle}
			<button class="toggle" class:toggle-off={isOff}
				onpointerdown={(e) => { e.stopPropagation(); pressed = true; }}
				onpointerup={() => pressed = false}
				onpointerleave={() => pressed = false}
				onclick={(e) => { e.stopPropagation(); handleToggle(); }}>
				{isOff ? 'OFF' : 'ON'}
			</button>
		{:else if cstate.unlocked}
			<div class="acc-value">{cstate.attempts > 0 ? `${accuracy}%` : '—'}</div>
		{/if}
	</div>
</div>

<style>
	.card {
		position: relative; overflow: hidden;
		background: var(--surface);
		border-left: 3px solid var(--accent);
		cursor: pointer;
		transition: border-left-color 0.15s;
	}
	.card.playing { border-left-color: var(--marathon-blue); }
	.card-fill {
		position: absolute; top: 0; left: 0; bottom: 0;
		background: var(--accent); opacity: 0.12;
		transition: width 0.35s ease-out;
	}
	.card-content {
		position: relative; z-index: 1;
		display: grid; grid-template-columns: 3.5rem 1fr auto;
		align-items: center; gap: 0.75rem; padding: 0.85rem;
	}
	.locked { opacity: 0.4; border-left-color: var(--hot); }
	.disabled { opacity: 0.55; border-left-color: var(--hot); }
	.disabled .id { color: var(--hot); }
	.id {
		font-size: 1.4rem; font-weight: 900;
		font-family: 'BPdots', var(--mono); text-align: center;
		color: var(--accent); line-height: 1;
	}
	.locked .id { color: var(--hot); }
	.mastery-dots {
		display: block; font-size: 0.5rem; line-height: 1;
		letter-spacing: 0.1em; margin-top: 2px;
	}
	.name { font-weight: 400; font-size: 0.85rem; letter-spacing: 0.02em; font-family: var(--font-display); }
	.stats { font-size: 0.4rem; color: var(--text-secondary); font-weight: 600; font-family: var(--mono); display: flex; align-items: center; gap: 2px; opacity: 0.7; }
	.stat-tag {
		display: inline-flex; align-items: center;
		border: 1px solid var(--accent); padding: 0 4px;
		font-size: 0.35rem; font-family: var(--mono);
		color: var(--accent); font-weight: 900;
		white-space: nowrap; line-height: 1.6;
	}
	.stat-value {
		display: inline-flex; align-items: center;
		font-size: 0.35rem; font-family: var(--mono);
		color: var(--text-primary); font-weight: 900;
		padding: 0 6px 0 3px; white-space: nowrap; line-height: 1.6;
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
	}
	.toggle {
		font-family: var(--mono); font-size: 0.45rem; font-weight: 900;
		letter-spacing: 0.05em; padding: 0.3rem 0.5rem;
		border: 1px solid var(--marathon-blue); background: var(--surface);
		color: var(--marathon-blue); cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
		width: 2.8rem; height: 1.4rem;
	}
	.toggle-off { border-color: var(--hot); background: #ED174F10; color: var(--hot); }
</style>
