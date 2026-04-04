import type { UserStateV4, ContentKind } from '$lib/state/schema';
import { buildIntervalState, isModeMastered } from '$lib/state/compat';
import { INTERVALS } from '$lib/definitions/intervals';
import { canAccess, getUserTier } from '$lib/features/gate';

/**
 * Single source of truth: can this user access this content kind?
 * Combines mastery gates (earned) with Pro gates (paid).
 */
export function isContentKindAvailable(state: UserStateV4, kind: ContentKind): boolean {
	if (state.settings.devMode) return true;

	const userTier = getUserTier(state.settings);

	if (kind === 'interval') return true; // always available

	// Count bronze-mastered intervals
	let bronzeCount = 0;
	for (const def of INTERVALS) {
		const ds = state.definitions.intervals[def.id];
		if (!ds?.unlocked) continue;
		const istate = buildIntervalState(state, def.id);
		const mastered = [istate.modes.ascending, istate.modes.descending, istate.modes.harmonic]
			.filter(m => isModeMastered(m)).length;
		if (mastered >= 1) bronzeCount++;
	}

	if (kind === 'chord') return bronzeCount >= 5;
	if (kind === 'scale') return bronzeCount >= 3;
	if (kind === 'mode') {
		const anyModeUnlocked = Object.values(state.definitions.modes).some(m => m.unlocked);
		return anyModeUnlocked && bronzeCount >= 5 && canAccess('content:modes', userTier, state.settings.devMode ?? false);
	}

	return false;
}
