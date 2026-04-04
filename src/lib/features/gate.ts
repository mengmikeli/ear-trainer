import type { ContentPack } from '$lib/state/schema';

export type FeatureId =
  | 'pack:blues'
  | 'pack:jazz'
  | 'pack:advanced'
  | 'content:chords'
  | 'content:scales'
  | 'content:modes'
  | 'content:adaptive'
  | string;

export type Tier = 'free' | 'pro';

export interface FeatureFlag {
  id: FeatureId;
  tier: Tier;
  enabled: boolean;
  devOverride?: boolean;
}

const FLAGS: FeatureFlag[] = [
  { id: 'pack:blues', tier: 'pro', enabled: true, devOverride: true },
  { id: 'pack:jazz', tier: 'pro', enabled: true, devOverride: true },
  { id: 'pack:advanced', tier: 'pro', enabled: true, devOverride: true },
];

function findFlag(id: FeatureId): FeatureFlag | undefined {
  return FLAGS.find(f => f.id === id);
}

export function canAccess(id: FeatureId, userTier: Tier = 'free', devMode: boolean = false): boolean {
  const flag = findFlag(id);
  if (!flag) return true; // not registered = accessible
  if (!flag.enabled) return false; // kill switch
  if (devMode && flag.devOverride !== false) return true; // dev bypass
  if (flag.tier === 'free') return true;
  return userTier === 'pro';
}

/** Check if a content pack is accessible for the given user. Beginner is always free. */
export function canAccessPack(pack: ContentPack, userTier: Tier, devMode: boolean): boolean {
  if (pack === 'beginner') return true;
  return canAccess(`pack:${pack}`, userTier, devMode);
}

export function getUserTier(settings: { proUnlocked?: boolean; devMode?: boolean }): Tier {
  if (settings.devMode) return 'pro'; // dev mode = pro access
  return settings.proUnlocked ? 'pro' : 'free';
}

export function isProFeature(id: FeatureId): boolean {
  const flag = findFlag(id);
  return flag?.tier === 'pro';
}

export function getAvailableFeatures(userTier: Tier = 'free', devMode: boolean = false): FeatureId[] {
  // Return all registered + unregistered features the user can access
  return FLAGS.filter(f => canAccess(f.id, userTier, devMode)).map(f => f.id);
}
