export interface ResponseInput {
	correct: boolean;
	replays: number;
	responseTimeMs: number;
}

export function responseQuality(input: ResponseInput): number {
	if (!input.correct) return 1;
	if (input.replays > 0) return 4;
	if (input.responseTimeMs > 5000) return 3;
	return 5;
}

export interface Sm2Result {
	easeFactor: number;
	intervalMs: number;
}

export function calculateSm2(easeFactor: number, quality: number): Sm2Result {
	const newEf = Math.max(
		1.3,
		easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
	);

	let intervalDays: number;
	if (quality < 3) {
		intervalDays = 0.0007; // ~1 minute — review soon
	} else {
		intervalDays = newEf * 0.5;
	}

	return {
		easeFactor: newEf,
		intervalMs: Math.round(intervalDays * 24 * 60 * 60 * 1000),
	};
}
