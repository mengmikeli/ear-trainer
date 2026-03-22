export const APP_VERSION = '3.0';

export interface ReleaseNote {
	version: string;
	date: string;
	title: string;
	changes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
	{
		version: '3.0',
		date: '2026-03-22',
		title: 'PLAY MODES + MASTERY',
		changes: [
			'Three play modes: ascending ▲, descending ▼, harmonic ═',
			'Harmonic mode — hear both notes at once',
			'Per-mode stats tracking with weakness-weighted question selection',
			'Mastery system: Bronze ● / Silver ●● / Gold ●●● badges',
			'Mastery = 20+ attempts at 85%+ accuracy per mode',
			'Redesigned home page with skill bars and mode toggles',
			'Settings: mode toggles replace direction selector',
		],
	},
	{
		version: '2.0',
		date: '2026-03-22',
		title: 'HUD OVERHAUL',
		changes: [
			'Tau Ceti-inspired HUD telemetry elements',
			'BPdots Unicase Square font for interval IDs',
			'Light / Dark / System theme toggle',
			'Interval enable/disable toggles on progress page',
			'Sound effects for correct/wrong answers',
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
			'Clean/Ambient tone types',
			'Long-press reset with glitch effect',
		],
	},
];
