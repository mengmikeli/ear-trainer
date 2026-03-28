export const APP_VERSION = '3.4';

export interface ReleaseNote {
	version: string;
	date: string;
	title: string;
	changes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
	{
		version: '3.4',
		date: '2026-03-28',
		title: 'VISUALIZATION',
		changes: [
			'Chladni particle visualization on quiz pages — reacts to audio in real-time',
			'Animated ring with orbiting dot and per-note bounce',
			'Damped oscillation for chords and harmonic intervals',
			'Red/green feedback on correct and wrong answers',
			'Glitch text transitions between questions',
			'Wrong-answer countdown bar with tap-to-replay',
			'Supercharge Viz toggle (Dev Mode) — enable particles on mobile',
			'Light mode support',
			'New app icon',
			'Performance: CSS-based ring, idle animation pausing',
			'Audio fixes: improved AudioContext handling, eliminated double-play on scales',
		],
	},
	{
		version: '3.3',
		date: '2026-03-26',
		title: 'SCALES + VISUALIZATION',
		changes: [
			'Scale identification quiz — 8 scales across 3 tiers with mastery tracking',
			'Visualization lab — chord, scale, and interval visualizations with audio-reactive Chladni + harmonograph',
			'Chromatic circle scale visualization with polygon trail',
			'Interruptible playback — switch selections mid-play, audio stops on page exit',
			'Shorthand labels for all content types',
		],
	},
	{
		version: '3.2',
		date: '2026-03-24',
		title: 'CHORDS + LAB',
		changes: [
			'Chord identification quiz — Major, Minor, Dim, Aug + 7th chords across 4 tiers',
			'Block and arpeggiated chord playback toggle',
			'Per-voicing mastery tracking (Root / 1st Inv / 2nd Inv)',
			'Chord progress tab with voicing sub-filters',
			'INTERVALS / CHORDS switcher on home and progress pages',
			'Lissajous + Chladni visualization lab — 4-way mirror, 13 interval patterns',
			'Dev mode toggle in settings — bypasses mastery gates, shows lab link',
			'Chord voicing toggles in settings',
		],
	},
	{
		version: '3.1',
		date: '2026-03-22',
		title: 'PROGRESS + POLISH',
		changes: [
			'End-of-quiz debrief screen with score breakdown',
			'Tap missed intervals on debrief to replay',
			'Tabbed progress page — filter by mode (ALL / ASC / DESC / HARM)',
			'Tap interval cards on progress page to preview sound',
			'Electric piano tone (FM synthesis) for clearer harmonic intervals',
			'Skip arrow on correct answer card — tap to advance',
			'Consistent stat labels and telemetry styling',
		],
	},
	{
		version: '3.0',
		date: '2026-03-22',
		title: 'PLAY MODES + MASTERY',
		changes: [
			'Three play modes: ascending, descending, harmonic',
			'Harmonic mode — hear both notes simultaneously',
			'Per-mode stats tracking with weakness-weighted selection',
			'Mastery system: Bronze / Silver / Gold per interval',
			'Mode indicator glyph on quiz bar',
			'Restored RadarGrid cover page',
		],
	},
	{
		version: '2.0',
		date: '2026-03-22',
		title: 'HUD OVERHAUL',
		changes: [
			'Tau Ceti-inspired HUD with RadarGrid and telemetry bar',
			'BPdots Unicase Square font for interval IDs',
			'Light / Dark / System theme toggle',
			'Interval enable/disable toggles on progress page',
			'Auto-play interval on question load',
			'Electric indigo nav accent color',
		],
	},
	{
		version: '1.0',
		date: '2026-03-21',
		title: 'MVP',
		changes: [
			'13 intervals across 5 tiers',
			'SM-2 spaced repetition engine',
			'Multiple choice quiz with adaptive question selection',
			'Marathon "Graphic Realism" visual style',
			'Maratype + Matrix Mono + BPdots typography',
			'Warm / Ambient tone types',
			'Long-press reset with glitch effect',
		],
	},
];
