<script lang="ts">
	import type { IntervalDef, IntervalState } from '$lib/types';

	interface Props {
		def: IntervalDef;
		state: IntervalState;
		ontoggle?: (id: string) => void;
	}
	let { def, state: istate, ontoggle }: Props = $props();

	const accuracy = $derived(istate.attempts > 0 ? Math.round((istate.correct / istate.attempts) * 100) : 0);

	let toggleGlitch = $state(false);
	let displayText = $state('');
	const glyphs = ['\uE000', '\uE002', '\uE013', '\uE014', '\uE015', '\uE017'];

	const currentToggleText = $derived(istate.enabled ? '[ON]' : '[OFF]');

	function handleToggle() {
		if (!ontoggle || toggleGlitch) return;
		toggleGlitch = true;
		let tick = 0;
		const totalTicks = 8;
		const iv = setInterval(() => {
			displayText = '[' + glyphs[Math.floor(Math.random() * glyphs.length)] + ']';
			tick++;
			if (tick >= totalTicks) {
				clearInterval(iv);
				toggleGlitch = false;
				displayText = '';
				ontoggle(def.id);
			}
		}, 60);
	}
</script>

<div class="card" class:locked={!istate.unlocked} class:disabled={istate.unlocked && !istate.enabled}>
	<div class="card-fill" style="width: {istate.unlocked && istate.enabled ? accuracy : 0}%"></div>
	<div class="card-content">
		<div class="id">{istate.unlocked ? def.id : '⊘'}</div>
		<div class="info">
			<div class="name">{def.name}</div>
			{#if istate.unlocked && istate.attempts === 0}
				<div class="stats new">NEW</div>
			{:else if istate.unlocked}
				<div class="stats"><span class="acc-tag">{accuracy}%</span> · {istate.attempts} {istate.attempts === 1 ? 'attempt' : 'attempts'}</div>
			{:else}
				<div class="stats"><span class="tier-tag">T{def.tier}</span> LOCKED</div>
			{/if}
		</div>
		{#if istate.unlocked && ontoggle}
			<button class="toggle" class:toggle-off={!istate.enabled} class:glitching={toggleGlitch} onclick={handleToggle}>
				{displayText || currentToggleText}
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
	}
	.card-fill {
		position: absolute; top: 0; left: 0; bottom: 0;
		background: var(--accent);
		opacity: 0.07;
		transition: width 0.6s ease-out;
	}
	.card-content {
		position: relative; z-index: 1;
		display: grid; grid-template-columns: 3.5rem 1fr auto;
		align-items: center; gap: 0.75rem; padding: 0.85rem;
	}
	.locked { opacity: 0.4; border-left-color: var(--hot); }
	.disabled { opacity: 0.55; border-left-color: var(--hot); }
	.disabled .id { color: var(--hot); }
	.disabled .name { color: var(--text-secondary); }
	.id {
		font-size: 1.2rem; font-weight: 900;
		font-family: 'JetBrains Mono', monospace; text-align: center;
		color: var(--accent);
	}
	.locked .id { color: var(--hot); font-size: 2rem; }
	.name { font-weight: 400; font-size: 0.85rem; letter-spacing: 0.02em; font-family: var(--font-display); }
	.stats { font-size: 0.4rem; color: var(--text-secondary); font-weight: 600; font-family: var(--mono); letter-spacing: 0.05em; display: flex; align-items: center; gap: 0; }
	.new { color: var(--accent); font-weight: 900; letter-spacing: 0.2em; }
	.tier-tag {
		display: inline-flex; align-items: center;
		border: 1px solid var(--hot); padding: 0 4px;
		font-size: 0.35rem; font-family: var(--mono);
		color: var(--hot); margin-right: 4px;
	}
	.acc-tag {
		display: inline-flex; align-items: center;
		border: 1px solid var(--accent); padding: 0 4px;
		font-size: 0.35rem; font-family: var(--mono);
		color: var(--accent); vertical-align: middle;
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
		transition: all 0.15s;
	}
	.toggle-off {
		border-color: var(--hot); background: #ED174F10;
		color: var(--hot);
	}
	.toggle.glitching {
		text-shadow: -1px 0 var(--accent), 1px 0 var(--hot);
		animation: toggle-shake 40ms infinite;
	}
	@keyframes toggle-shake {
		0% { transform: translate(0); }
		25% { transform: translate(-1px, 1px); }
		50% { transform: translate(1px, -1px); }
		75% { transform: translate(-1px, -1px); }
		100% { transform: translate(0); }
	}
</style>
