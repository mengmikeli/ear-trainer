export type FeatureId =
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
  // Intervals: tiers 1-2 free, 3-4 pro
  { id: 'content:intervals:tier3', tier: 'pro', enabled: true, devOverride: true },
  { id: 'content:intervals:tier4', tier: 'pro', enabled: true, devOverride: true },
  // Chords: tier 1 free, 2-4 pro
  { id: 'content:chords:tier2', tier: 'pro', enabled: true, devOverride: true },
  { id: 'content:chords:tier3', tier: 'pro', enabled: true, devOverride: true },
  { id: 'content:chords:tier4', tier: 'pro', enabled: true, devOverride: true },
  // Scales: tier 1 free, 2-4 pro
  { id: 'content:scales:tier2', tier: 'pro', enabled: true, devOverride: true },
  { id: 'content:scales:tier3', tier: 'pro', enabled: true, devOverride: true },
  { id: 'content:scales:tier4', tier: 'pro', enabled: true, devOverride: true },
  // Modes: all pro
  { id: 'content:modes', tier: 'pro', enabled: true, devOverride: true },
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
