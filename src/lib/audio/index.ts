/**
 * Audio module — re-exports the public API from all submodules.
 *
 * The exported API is a superset of the old audio.ts exports so existing
 * code can transition gradually. New code should import from submodules directly.
 *
 * Module structure:
 * - context.ts:  Singleton AudioContext, master gain, analyser
 * - synths.ts:   Tone generators (epiano, sine, piano) — pure functions
 * - playback.ts: High-level playback with generation-based cancellation
 * - drone.ts:    Drone lifecycle (own gain chain, separate from playback)
 * - session.ts:  Media session metadata, iOS audio session type
 */

// context.ts — core audio infrastructure
export {
	getContext,
	ensureResumed,
	getMasterOutput,
	getAnalyser,
	getAmplitude,
	warmUpAudio,
	isAudioReady,
	midiToFreq,
	stopAudio,
	suspendAudio,
	cancelScheduledSuspend,
	resumeAudio,
} from './context';

// synths.ts — pure tone generators
export {
	playEpianoToneToNode,
	playSineToneToNode,
	playPianoToneToNode,
} from './synths';

// playback.ts — high-level playback with generation-based cancellation
export {
	playInterval,
	playChord,
	playNote,
	playScale,
	playFeedbackChime,
} from './playback';

// drone.ts — drone lifecycle
export {
	startDrone,
	stopDrone,
	forceStopDrone,
	getActiveDrone,
} from './drone';
export type { DroneHandle } from './drone';

// session.ts — media session + iOS
export {
	setMediaSessionMetadata,
	clearMediaSession,
	setIOSAudioSessionPlayback,
	clearIOSAudioSession,
} from './session';
