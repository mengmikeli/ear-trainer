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
