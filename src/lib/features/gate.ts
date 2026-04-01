export type FeatureId =
  | 'content:chords'
  | 'content:scales'
  | 'content:modes'
  | 'content:adaptive'
  | 'quiz:session_length_30'
  | 'lab:ascii'
  | 'settings:tone_piano'
  | string;

export type Tier = 'free' | 'pro';

export interface FeatureFlag {
  id: FeatureId;
  tier: Tier;
  enabled: boolean;
  devOverride?: boolean;
}

// Empty registry — everything accessible. Edit to gate features.
const FLAGS: FeatureFlag[] = [];

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

export function isProFeature(id: FeatureId): boolean {
  const flag = findFlag(id);
  return (flag?.tier === 'pro') ?? false;
}

export function getAvailableFeatures(userTier: Tier = 'free', devMode: boolean = false): FeatureId[] {
  // Return all registered + unregistered features the user can access
  return FLAGS.filter(f => canAccess(f.id, userTier, devMode)).map(f => f.id);
}
