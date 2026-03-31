/**
 * Media session + iOS audio session helpers.
 *
 * The "make the OS happy" layer — media session metadata for lock screen,
 * iOS audio session type for silent mode bypass.
 */

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
