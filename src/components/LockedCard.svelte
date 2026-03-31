<script lang="ts">
  let { feature = '' }: { feature?: string } = $props();
</script>

<div class="locked-card">
  <span class="lock-icon">🔒</span>
  <span class="lock-label">PRO</span>
</div>

<style>
  .locked-card {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--surface, #1A1A1A);
    border: 1px solid var(--border-heavy, #333);
    opacity: 0.5;
    font-family: var(--mono, monospace);
  }
  .lock-icon { font-size: 1.2rem; }
  .lock-label {
    font-size: 0.4rem;
    font-weight: 900;
    letter-spacing: 0.15em;
    color: var(--text-secondary, #666);
  }
</style>
