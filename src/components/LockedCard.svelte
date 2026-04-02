<script lang="ts">
  let { feature = '', onUnlock, devMode = false }: { feature?: string; onUnlock?: () => void; devMode?: boolean } = $props();
</script>

<div class="locked-card">
  <div class="locked-header">
    {#if feature}
      <span class="feature-name">{feature}</span>
    {/if}
    <div class="locked-badge">
      <span class="lock-label">PRO</span>
    </div>
  </div>
  {#if onUnlock && devMode}
    <button class="unlock-btn" onclick={onUnlock}>
      UNLOCK
    </button>
  {/if}
</div>

<style>
  .locked-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--surface, #1A1A1A);
    border: 1px solid color-mix(in srgb, var(--marathon-blue, #3A2CFF) 40%, var(--border-heavy, #333));
    font-family: var(--mono, monospace);
    min-height: 3.5rem;
  }
  .locked-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }
  .feature-name {
    font-size: 0.4rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-secondary, #666);
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .locked-badge {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
  }
  .lock-label {
    font-size: 0.35rem;
    font-weight: 900;
    letter-spacing: 0.2em;
    color: var(--marathon-blue, #3A2CFF);
  }
  .unlock-btn {
    flex-shrink: 0;
    font-family: var(--mono, monospace);
    font-size: 0.3rem;
    font-weight: 900;
    letter-spacing: 0.15em;
    color: var(--base, #0A0A0A);
    background: var(--marathon-blue, #3A2CFF);
    border: none;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
    text-transform: uppercase;
    transition: opacity 0.15s;
  }
  .unlock-btn:active {
    opacity: 0.8;
  }
</style>
