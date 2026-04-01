/**
 * Media session + iOS audio session helpers.
 *
 * The "make the OS happy" layer — media session metadata for lock screen,
 * iOS audio session type for silent mode bypass.
 *
 * Hybrid model: AudioContext stays alive always (warm buffer).
 * Only the iOS audio session + media session metadata toggle based on
 * actual playback activity. Auto-releases after 10s of silence.
 */

// ─── Claim / Release lifecycle ──────────────────────────────────────────────

let sessionClaimed = false;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
const RELEASE_DELAY_MS = 10000; // 10 seconds of silence → release

/** Claim iOS audio session + media session metadata on actual playback. */
export function claimAudioSession(): void {
	if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null; }
	if (sessionClaimed) return;

	// Claim iOS audio session
	if ('audioSession' in navigator && 'type' in (navigator as any).audioSession) {
		(navigator as any).audioSession.type = 'playback';
	}

	// Set media session metadata
	if ('mediaSession' in navigator) {
		navigator.mediaSession.metadata = new MediaMetadata({
			title: 'Ear Trainer',
			artist: 'Ear Trainer',
			album: 'Practice',
		});
		navigator.mediaSession.playbackState = 'playing';
	}

	sessionClaimed = true;
}

/** Release iOS audio session + clear media session (return audio to other apps). */
export function releaseAudioSession(): void {
	if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null; }

	// Release iOS audio session
	if ('audioSession' in navigator && 'type' in (navigator as any).audioSession) {
		(navigator as any).audioSession.type = 'auto';
	}

	// Clear media session
	if ('mediaSession' in navigator) {
		navigator.mediaSession.metadata = null;
		navigator.mediaSession.playbackState = 'none';
	}

	sessionClaimed = false;
}

/** Schedule a release after RELEASE_DELAY_MS of silence. */
export function scheduleRelease(): void {
	if (releaseTimer) clearTimeout(releaseTimer);
	releaseTimer = setTimeout(() => {
		releaseAudioSession();
		releaseTimer = null;
	}, RELEASE_DELAY_MS);
}

/** Cancel any pending scheduled release (e.g. when new playback starts). */
export function cancelScheduledRelease(): void {
	if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null; }
}

/** Check if the audio session is currently claimed. */
export function isSessionClaimed(): boolean {
	return sessionClaimed;
}

// ─── Legacy helpers (backward compat) ───────────────────────────────────────

/** Set media session metadata so lock screen shows app name, not "localhost". */
export function setMediaSessionMetadata(title: string = 'Ear Trainer'): void {
	if ('mediaSession' in navigator) {
		navigator.mediaSession.metadata = new MediaMetadata({
			title,
			artist: 'Ear Trainer',
			album: 'Practice',
		});
		navigator.mediaSession.playbackState = 'playing';
	}
}

/** Clear media session so lock screen / Dynamic Island don't show stale info. */
export function clearMediaSession(): void {
	if ('mediaSession' in navigator) {
		navigator.mediaSession.metadata = null;
		navigator.mediaSession.playbackState = 'none';
	}
}

/** Set iOS audio session type to playback (sound plays even in silent mode). */
export function setIOSAudioSessionPlayback(): void {
	if ('audioSession' in navigator && 'type' in (navigator as any).audioSession) {
		(navigator as any).audioSession.type = 'playback';
	}
}

/** Clear iOS audio session type (revert to auto). */
export function clearIOSAudioSession(): void {
	if ('audioSession' in navigator && 'type' in (navigator as any).audioSession) {
		(navigator as any).audioSession.type = 'auto';
	}
}
