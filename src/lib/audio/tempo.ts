/**
 * Shared tempo constants for audio playback.
 *
 * All playback contexts (quiz configs, progress page, lab pages)
 * should import from here. One place to tune timing.
 *
 * Values are in milliseconds between note onsets.
 */

/** Scale playback — 380ms per note. Musical enough to identify character,
 *  fast enough for quiz flow. Lab uses 500ms (visualization-paced). */
export const SCALE_TEMPO = 380;

/** Mode playback — slightly slower than scales to let the drone
 *  establish tonality before the mode runs. */
export const MODE_TEMPO = 400;

/** Interval melodic note duration (seconds) */
export const INTERVAL_NOTE_DURATION = 0.6;

/** Interval gap between notes — varies by tone type */
export const INTERVAL_GAP_PIANO = 0.3;
export const INTERVAL_GAP_DEFAULT = 0.15;

/** Chord block duration (seconds) */
export const CHORD_BLOCK_DURATION = 1.2;

/** Chord arpeggio delay between notes (seconds) */
export const CHORD_ARP_DELAY = 0.15;
