/** Short listening mnemonics — one per content item. */
export const LISTENING_TIPS: Record<string, string> = {
	// Intervals
	'P1': 'Same note repeated — no pitch change',
	'P5': 'Think "Star Wars" opening fanfare',
	'P8': 'Same note, one octave higher — sounds like it "comes home"',
	'M3': 'Start of a happy birthday song',
	'm3': 'Start of a sad, melancholic melody',
	'P4': 'Think "Here Comes the Bride"',
	'M2': 'A single scale step up — like "Do Re"',
	'M6': 'Think "My Bonnie Lies Over the Ocean"',
	'm7': 'The original Star Trek theme opening',
	'M7': 'Bright, almost dissonant — one step below the octave',
	'm2': 'Jaws theme — tense, creeping half-step',
	'm6': 'Dark, wide — think beginning of "The Entertainer" in minor',
	'TT': 'The "devil\'s interval" — unstable, wants to resolve',

	// Chords
	'maj': 'Bright, happy, stable — the default "good" sound',
	'min': 'Darker, sadder — same shape, different color',
	'dim': 'Tense, unstable — like something scary is about to happen',
	'aug': 'Dreamy, floating — each note equally spaced',
	'maj7': 'Smooth, jazzy — major chord with a shimmering top',
	'min7': 'Mellow, warm — the chill jazz chord',
	'dom7': 'Bluesy tension — wants to resolve somewhere',
	'dim7': 'Fully diminished — eerie, symmetrical, endlessly ambiguous',
	'hdim7': 'Half-diminished — tense but with more warmth than full dim',
	'aug7': 'Augmented with a 7th — exotic, unresolved shimmer',
	'sus2': 'Open, airy — neither happy nor sad',
	'sus4': 'Suspended, expectant — wants to resolve to major or minor',
	'pow': 'Raw, powerful — just root and fifth, no color',

	// Scales
	'major': 'The "Do Re Mi" scale — bright, familiar, happy',
	'nat_min': 'Sad, dark version of Do Re Mi',
	'maj_pent': 'The "blues lick" scale — skip the awkward notes',
	'min_pent': 'Every rock guitar solo ever',
	'harm_min': 'Classical drama — raised 7th gives it that exotic tension',
	'blues': 'Minor pentatonic + the "blue note" — pure attitude',
	'whole': 'Every step the same size — dreamy, Debussy-like',
	'mel_min': 'Minor going up, natural coming down — classical voice leading',
	'chromatic': 'Every single semitone — tension city, no home base',
	'dorian_scale': 'Minor but with a bright 6th — jazzy, sophisticated',
	'mixolydian_scale': 'Major but with a flat 7th — bluesy, rock feel',

	// Modes
	'ionian': 'Standard major scale — bright, resolved',
	'aeolian': 'Natural minor — dark, melancholic',
	'dorian': 'Minor with a bright spot — think jazz, Santana',
	'mixolydian': 'Major with a bluesy twist — Grateful Dead, classic rock',
	'phrygian': 'Spanish, exotic — dark and dramatic',
	'lydian': 'Dreamy, floating major — the "movie magic" sound',
	'locrian': 'Darkest mode — almost unusable but fascinating',
};
