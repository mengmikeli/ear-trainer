import { describe, it, expect } from 'vitest';
import { canAccess, isProFeature, getAvailableFeatures } from '$lib/features/gate';

describe('canAccess', () => {
  it('returns true for unregistered features', () => {
    expect(canAccess('anything')).toBe(true);
  });

  it('returns true for unregistered features regardless of tier', () => {
    expect(canAccess('unknown:feature', 'free')).toBe(true);
    expect(canAccess('unknown:feature', 'pro')).toBe(true);
  });
});

describe('isProFeature', () => {
  it('returns false for unregistered features', () => {
    expect(isProFeature('anything')).toBe(false);
  });
});

describe('getAvailableFeatures', () => {
  it('returns empty array with empty registry', () => {
    expect(getAvailableFeatures()).toEqual([]);
  });
});
