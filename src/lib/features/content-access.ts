import type { UserStateV4, ContentKind } from '$lib/state/schema';
import { buildIntervalState, isModeMastered } from '$lib/state/compat';
import { INTERVALS } from '$lib/definitions/intervals';
import { canAccessPack, getUserTier } from '$lib/features/gate';

/**
 * Single source of truth: can this user access this content kind?
 * Combines mastery gates (earned) with Pro gates (paid).
 */
export function isContentKindAvailable(state: UserStateV4, kind: ContentKind): boolean {
	if (state.settings.devMode) return true;

	const userTier = getUserTier(state.settings);

	if (kind === 'interval') return true; // always available (beginner pack)

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

	// Chords: available if user has unlocked any chord (beginner pack has Major/Minor)
	if (kind === 'chord') return bronzeCount >= 5;

	// Scales: available if user has unlocked any scale (beginner pack has Major/Natural Minor)
	if (kind === 'scale') return bronzeCount >= 3;

	// Modes: available only if advanced pack is accessible (Pro) AND scale mastery earned
	if (kind === 'mode') {
		const anyModeUnlocked = Object.values(state.definitions.modes).some(m => m.unlocked);
		return anyModeUnlocked && bronzeCount >= 5 && canAccessPack('advanced', userTier, state.settings.devMode ?? false);
	}

	return false;
}
