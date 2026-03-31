/**
 * v4 state module — barrel export.
 *
 * Re-exports everything from the individual sub-modules so consumers can
 * do `import { ... } from '$lib/state'` without knowing the internal split.
 */

export * from './schema';
export * from './defaults';
export * from './storage';
export * from './migration';
export * from './progression';
export * from './stats';
