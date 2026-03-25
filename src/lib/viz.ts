/**
 * Just intonation frequency ratios for Lissajous visualization.
 * Maps interval ID → [numerator, denominator].
 */
export const LISSAJOUS_RATIOS: Record<string, [number, number]> = {
	P1: [1, 1],
	m2: [16, 15],
	M2: [9, 8],
	m3: [6, 5],
	M3: [5, 4],
	P4: [4, 3],
	TT: [7, 5],
	P5: [3, 2],
	m6: [8, 5],
	M6: [5, 3],
	m7: [9, 5],
	M7: [15, 8],
	P8: [2, 1],
};

/** Get ratio for an interval ID, defaults to 1:1 */
export function getRatio(intervalId: string): [number, number] {
	return LISSAJOUS_RATIOS[intervalId] ?? [1, 1];
}

/** Chladni equation: nodal lines where this equals zero */
export function chladni(x: number, y: number, n: number, m: number): number {
	return Math.cos(n * x) * Math.cos(m * y) - Math.cos(m * x) * Math.cos(n * y);
}

/** Gradient of Chladni function (for particle drift) */
export function chladniGrad(x: number, y: number, n: number, m: number): [number, number] {
	const h = 0.01;
	const dx = (chladni(x + h, y, n, m) - chladni(x - h, y, n, m)) / (2 * h);
	const dy = (chladni(x, y + h, n, m) - chladni(x, y - h, n, m)) / (2 * h);
	return [dx, dy];
}

// ── Superposition Chladni (multi-mode for chords) ──────────────────

/** A single Chladni mode with optional amplitude weight */
export interface ChladniMode {
	n: number;
	m: number;
	amp: number;  // amplitude weight (default 1)
}

/**
 * Superposition of multiple Chladni modes.
 * Returns combined displacement — nodal lines are where this ≈ 0.
 */
export function chladniSuper(x: number, y: number, modes: ChladniMode[]): number {
	let sum = 0;
	for (const { n, m, amp } of modes) {
		sum += amp * (Math.cos(n * x) * Math.cos(m * y) - Math.cos(m * x) * Math.cos(n * y));
	}
	return sum;
}

/**
 * Gradient of superposed Chladni field (for particle drift toward combined nodal lines).
 */
export function chladniGradSuper(x: number, y: number, modes: ChladniMode[]): [number, number] {
	const h = 0.01;
	const dx = (chladniSuper(x + h, y, modes) - chladniSuper(x - h, y, modes)) / (2 * h);
	const dy = (chladniSuper(x, y + h, modes) - chladniSuper(x, y - h, modes)) / (2 * h);
	return [dx, dy];
}

/**
 * Map a MIDI note to a Chladni plate mode (n, m).
 * Lower notes → simpler modes, higher → more complex.
 * Returns [n, m] where n < m (avoids degenerate n=m case).
 */
export function midiToChladniMode(midi: number): [number, number] {
	const note = midi % 12;
	const modes: [number, number][] = [
		[1, 2], [2, 3], [1, 3], [3, 4], [2, 4], [1, 4],
		[3, 5], [2, 5], [4, 5], [3, 6], [2, 6], [5, 6],
	];
	return modes[note];
}

/**
 * Convert chord intervals (semitones from root) to ChladniMode[] for superposition.
 * Each chord tone maps to a plate mode via midiToChladniMode.
 * Amplitude is equal for all tones (can be weighted later).
 */
export function chordToModes(rootMidi: number, intervals: number[]): ChladniMode[] {
	return intervals.map((semitones) => {
		const [n, m] = midiToChladniMode(rootMidi + semitones);
		return { n, m, amp: 1 };
	});
}

// ── 3D Harmonograph (multi-frequency Lissajous for chords) ─────────

/** Just-intonation ratio for a semitone offset from root */
const JI_RATIOS: Record<number, number> = {
	0: 1,        // unison
	1: 16 / 15,  // m2
	2: 9 / 8,    // M2
	3: 6 / 5,    // m3
	4: 5 / 4,    // M3
	5: 4 / 3,    // P4
	6: 7 / 5,    // TT
	7: 3 / 2,    // P5
	8: 8 / 5,    // m6
	9: 5 / 3,    // M6
	10: 9 / 5,   // m7
	11: 15 / 8,  // M7
	12: 2,       // P8
};

/** Get just-intonation frequency ratio for a semitone offset */
export function jiRatio(semitones: number): number {
	return JI_RATIOS[semitones % 12] ?? 1;
}

/**
 * Compute a 3D harmonograph point for a chord.
 * Each note contributes one axis (or is distributed across axes for >3 notes).
 *
 * For triads (3 notes):  x = sin(f1*t), y = sin(f2*t), z = sin(f3*t)
 * For tetrads (4 notes): x = sin(f1*t) + 0.3*sin(f4*t), y = sin(f2*t), z = sin(f3*t)
 *   (4th note modulates the X axis — Moto's "root triad + extension" idea)
 *
 * Returns [x, y] after 3D→2D isometric projection.
 */
export function harmonograph3D(
	t: number,
	intervals: number[],
	radius: number,
	phaseOffset: number = Math.PI / 4,
	rotAngle: number = 0,
): [number, number] {
	const freqs = intervals.map((s) => jiRatio(s));

	let x: number, y: number, z: number;

	if (freqs.length <= 2) {
		// Fallback: standard 2D Lissajous
		x = Math.sin(freqs[0] * t + phaseOffset);
		y = Math.sin((freqs[1] ?? freqs[0]) * t);
		z = 0;
	} else if (freqs.length === 3) {
		// Triad: one frequency per axis
		x = Math.sin(freqs[0] * t + phaseOffset);
		y = Math.sin(freqs[1] * t);
		z = Math.sin(freqs[2] * t + phaseOffset * 0.5);
	} else {
		// Tetrad+: root triad on axes, extensions modulate X
		x = Math.sin(freqs[0] * t + phaseOffset);
		y = Math.sin(freqs[1] * t);
		z = Math.sin(freqs[2] * t + phaseOffset * 0.5);
		// Additional notes modulate with decreasing weight
		for (let i = 3; i < freqs.length; i++) {
			const weight = 0.3 / (i - 2);
			x += weight * Math.sin(freqs[i] * t + phaseOffset * (i * 0.3));
		}
	}

	// 3D → 2D isometric projection with rotation
	const cosR = Math.cos(rotAngle);
	const sinR = Math.sin(rotAngle);
	const px = (x * cosR - z * sinR) * radius;
	const py = (y * 0.85 + (x * sinR + z * cosR) * 0.35) * radius;

	return [px, py];
}
