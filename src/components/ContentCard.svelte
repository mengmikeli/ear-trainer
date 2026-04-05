<script lang="ts">
	/**
	 * ContentCard — unified card replacing IntervalCard, ChordCard, ScaleCard, ModeCard.
	 * Pure display component. All stat computation stays in the progress page.
	 */

	interface Props {
		id: string;
		label: string;
		name: string;
		tier: number;
		unlocked: boolean;
		enabled: boolean;
		accuracy: number;
		attempts: number;
		isNew: boolean;
		masteryDots: string;
		masteryColor: string;
		playing?: boolean;
		ontoggle?: (id: string) => void;
		onplay?: (id: string) => void;
	}

	let {
		id,
		label,
		name,
		tier,
		unlocked,
		enabled,
		accuracy,
		attempts,
		isNew,
		masteryDots,
		masteryColor,
		playing = false,
		ontoggle,
		onplay,
	}: Props = $props();

	let pendingFlip = $state(false);
	let pressed = $state(false);
	const isOff = $derived(pressed || pendingFlip ? enabled : !enabled);

	function handleToggle() {
		if (!ontoggle) return;
		pendingFlip = true;
		pressed = false;
		requestAnimationFrame(() => {
			ontoggle(id);
			pendingFlip = false;
		});
	}
</script>

<div class="card" class:locked={!unlocked} class:disabled={unlocked && !enabled} class:playing
	onclick={() => { if (unlocked && onplay) onplay(id); }}
	role={unlocked && onplay ? 'button' : undefined}
	tabindex={unlocked && onplay ? 0 : undefined}
>
	<div class="card-fill" style="width: {unlocked && enabled ? accuracy : 0}%"></div>
	<div class="card-content">
		<div class="id-col">
			{label}
		</div>
		<div class="info">
			<div class="name">{name}</div>
			{#if unlocked && isNew}
				<div class="stats new">NEW</div>
			{:else if unlocked}
				<div class="stats"><span class="stat-tag">ACC</span><span class="stat-value">{accuracy}%</span><span class="stat-tag">Q</span><span class="stat-value">{attempts}</span></div>
			{:else}
				<div class="stats locked-stats">UPGRADE TO UNLOCK</div>
			{/if}
		</div>
		{#if unlocked && ontoggle}
			<button class="toggle" class:toggle-off={isOff}
				onpointerdown={(e) => { e.stopPropagation(); pressed = true; }}
				onpointerup={() => pressed = false}
				onpointerleave={() => pressed = false}
				onclick={(e) => { e.stopPropagation(); handleToggle(); }}>
				{isOff ? 'OFF' : 'ON'}
			</button>
		{:else if unlocked}
			<div class="acc-value">{attempts > 0 ? `${accuracy}%` : '--'}</div>
		{:else}
			<span class="pro-badge">PRO</span>
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
		display: grid; grid-template-columns: 5.5rem 1fr auto;
		align-items: center; gap: 0.75rem; padding: 0.85rem;
	}
	.locked { opacity: 0.4; border-left-color: var(--hot); }
	.disabled { opacity: 0.55; border-left-color: var(--hot); transition: opacity 0.3s ease 0.3s; }
	.disabled .id-col { color: var(--hot); }
	.disabled .name { color: var(--text-secondary); }
	.disabled .toggle { opacity: calc(1 / 0.55); }
	.id-col {
		font-size: 2rem; font-weight: 900;
		font-family: 'BPdots', 'JetBrains Mono', monospace; text-align: center;
		color: var(--accent);
		line-height: 1;
		transform: translateY(-5px);
	}
	.locked .id-col { color: var(--hot); font-size: 2rem; }
	.mastery-dots {
		display: block;
		font-size: 0.5rem;
		line-height: 1;
		letter-spacing: 0.1em;
		margin-top: 2px;
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
		padding: 0 6px 0 3px;
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
	.pro-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--marathon-blue);
		color: var(--marathon-blue);
		font-family: var(--mono);
		font-size: 0.35rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		flex-shrink: 0;
		width: 2.8rem;
		height: 1.4rem;
		box-sizing: border-box;
	}
	.locked-stats {
		letter-spacing: 0.1em;
	}
</style>
