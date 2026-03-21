<script lang="ts">
  interface Props {
    segments: Array<{ label: string; value: string | number }>;
  }

  let { segments }: Props = $props();
</script>

<div class="telemetry-bar">
  {#each segments as seg}
    <span class="tag">{seg.label}</span><span class="val">{seg.value}</span>
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

  .tag {
    border: 1px solid var(--accent, #C2FE0C);
    padding: 0 6px;
    font-size: 0.4rem;
    font-family: var(--mono, 'Matrix Mono', 'JetBrains Mono', monospace);
    text-transform: uppercase;
    color: var(--accent, #C2FE0C);
    white-space: nowrap;
    line-height: 1.6;
  }

  .val {
    font-size: 0.4rem;
    font-family: var(--mono, 'Matrix Mono', 'JetBrains Mono', monospace);
    color: var(--text-primary, #F0F0F0);
    padding: 0 8px 0 4px;
    white-space: nowrap;
  }
</style>
