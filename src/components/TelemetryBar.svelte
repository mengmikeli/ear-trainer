<script lang="ts">
  interface Props {
    segments: Array<{ label: string; value: string | number }>;
  }

  let { segments }: Props = $props();

  const FULL_LABELS: Record<string, string> = {
    'STK': 'Streak',
    'ACC': 'Accuracy',
    'Q': 'Questions',
    'SES': 'Sessions',
  };

  let expanded: Record<string, boolean> = $state({});
  let timers: Record<string, ReturnType<typeof setTimeout>> = {};

  function tapSegment(label: string) {
    if (!FULL_LABELS[label]) return;
    // Clear existing timer for this label
    if (timers[label]) clearTimeout(timers[label]);
    expanded[label] = true;
    timers[label] = setTimeout(() => {
      expanded[label] = false;
    }, 2000);
  }
</script>

<div class="telemetry-bar">
  {#each segments as seg}
    <button class="segment" onclick={() => tapSegment(seg.label)} aria-label={FULL_LABELS[seg.label] ?? seg.label}>
      <span class="tag">{#if expanded[seg.label]}{FULL_LABELS[seg.label]}{:else}{seg.label}{/if}</span><span class="val">{seg.value}</span>
    </button>
  {/each}
</div>

<style>
  .telemetry-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 2px;
    opacity: 0.7;
  }

  .segment {
    display: inline-flex;
    align-items: center;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--accent, #C2FE0C);
    padding: 0 6px;
    font-size: 0.4rem;
    font-family: var(--mono, 'Matrix Mono', 'JetBrains Mono', monospace);
    text-transform: uppercase;
    color: var(--accent, #C2FE0C);
    white-space: nowrap;
    line-height: 1.6;
    transition: padding 0.15s ease;
  }

  .val {
    display: inline-flex;
    align-items: center;
    font-size: 0.4rem;
    font-family: var(--mono, 'Matrix Mono', 'JetBrains Mono', monospace);
    color: var(--text-primary, #F0F0F0);
    padding: 0 8px 0 4px;
    white-space: nowrap;
    line-height: 1.6;
  }
</style>
