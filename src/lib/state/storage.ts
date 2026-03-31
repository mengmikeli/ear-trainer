/**
 * v4 localStorage persistence layer.
 *
 * Loads/saves UserStateV4, transparently migrating legacy data on first access.
 */

import type { UserStateV4 } from './schema';
import { migrateToV4 } from './migration';
import { createDefaultStateV4 } from './defaults';

const STORAGE_KEY = 'ear-trainer-state';

/**
 * Load user state from storage.
 *
 * - Empty storage → fresh defaults.
 * - Corrupt JSON → fresh defaults.
 * - Legacy (pre-v4) data → migrated, then persisted back for one-time upgrade.
 */
export function loadStateV4(storage: Storage = localStorage): UserStateV4 {
	const raw = storage.getItem(STORAGE_KEY);
	if (!raw) return createDefaultStateV4();
	try {
		const parsed = JSON.parse(raw);
		const migrated = migrateToV4(parsed);
		// Persist if version changed (one-time migration)
		if (!parsed.version || parsed.version < 4) {
			storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
		}
		return migrated;
	} catch {
		return createDefaultStateV4();
	}
}

/** Save user state to storage as JSON. */
export function saveStateV4(
	state: UserStateV4,
	storage: Storage = localStorage,
): void {
	storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
