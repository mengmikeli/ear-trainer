/**
 * Pure tone generators — extracted from audio.ts.
 *
 * All functions are PURE: they take AudioContext + destination node + params,
 * create oscillators, schedule them, and return nothing. No global state access.
 *
 * The three synth engines:
 * - epiano: FM synthesis Rhodes-style (bell-like harmonics)
 * - sine: warm triangle wave
 * - piano: ambient pad (layered sines, chorus detune, shimmer)
 */

/**
 * Electric piano — FM synthesis Rhodes-style.
 * Clear attack, bell-like harmonics, great for harmonic intervals.
 * Routed to a specific destination node.
 */
export function playEpianoToneToNode(
	freq: number,
	startTime: number,
	duration: number,
	audioCtx: AudioContext,
	dest: AudioNode
): void {
	// Carrier: sine wave at fundamental
	const carrier = audioCtx.createOscillator();
	const carrierGain = audioCtx.createGain();
	carrier.type = 'sine';
	carrier.frequency.value = freq;

	// Modulator: sine wave at 2x fundamental (FM ratio = 2:1 for Rhodes character)
	const modulator = audioCtx.createOscillator();
	const modGain = audioCtx.createGain();
	modulator.type = 'sine';
	modulator.frequency.value = freq * 2;
	// Modulation depth — higher = more bell-like harmonics
	modGain.gain.setValueAtTime(freq * 1.5, startTime);
	modGain.gain.exponentialRampToValueAtTime(freq * 0.1, startTime + duration * 0.7);
	modGain.gain.linearRampToValueAtTime(0, startTime + duration);

	// FM: modulator → modGain → carrier.frequency
	modulator.connect(modGain);
	modGain.connect(carrier.frequency);

	// Carrier envelope — sharp attack, smooth decay
	carrierGain.gain.setValueAtTime(0, startTime);
	carrierGain.gain.linearRampToValueAtTime(0.35, startTime + 0.005); // snappy attack
	carrierGain.gain.exponentialRampToValueAtTime(0.15, startTime + 0.15);
	carrierGain.gain.setValueAtTime(0.15, startTime + duration - 0.2);
	carrierGain.gain.linearRampToValueAtTime(0, startTime + duration);

	carrier.connect(carrierGain);
	carrierGain.connect(dest);

	carrier.start(startTime);
	carrier.stop(startTime + duration);
	modulator.start(startTime);
	modulator.stop(startTime + duration);
}

/**
 * Sine tone — warm triangle wave, pure.
 * Routed to a specific destination node.
 */
export function playSineToneToNode(
	freq: number,
	startTime: number,
	duration: number,
	audioCtx: AudioContext,
	dest: AudioNode
): void {
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();

	// Use triangle wave for warmer sine-like tone
	osc.type = 'triangle';
	osc.frequency.value = freq;

	// Main envelope — snappy attack, smooth decay
	gain.gain.setValueAtTime(0, startTime);
	gain.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.08);
	gain.gain.setValueAtTime(0.25, startTime + duration - 0.15);
	gain.gain.linearRampToValueAtTime(0, startTime + duration);

	osc.connect(gain);
	gain.connect(dest);
	osc.start(startTime);
	osc.stop(startTime + duration);
}

/**
 * Ambient synth tone — pad-like, reverberant, dreamy.
 * Layered sine waves with slow attack, chorus detune, and convolution-like tail.
 * Routed to a specific destination node.
 */
export function playPianoToneToNode(
	freq: number,
	startTime: number,
	duration: number,
	audioCtx: AudioContext,
	dest: AudioNode
): void {
	const padDuration = duration + 0.4; // longer tail for ambient feel

	// Layer 1: Main sine
	const osc1 = audioCtx.createOscillator();
	const gain1 = audioCtx.createGain();
	osc1.type = 'sine';
	osc1.frequency.value = freq;
	gain1.gain.setValueAtTime(0, startTime);
	gain1.gain.linearRampToValueAtTime(0.2, startTime + 0.12); // slow attack
	gain1.gain.setValueAtTime(0.2, startTime + padDuration - 0.3);
	gain1.gain.linearRampToValueAtTime(0, startTime + padDuration);
	osc1.connect(gain1);

	// Layer 2: Detuned +5 cents — chorus width
	const osc2 = audioCtx.createOscillator();
	const gain2 = audioCtx.createGain();
	osc2.type = 'sine';
	osc2.frequency.value = freq * 1.003;
	gain2.gain.setValueAtTime(0, startTime);
	gain2.gain.linearRampToValueAtTime(0.12, startTime + 0.15);
	gain2.gain.setValueAtTime(0.12, startTime + padDuration - 0.3);
	gain2.gain.linearRampToValueAtTime(0, startTime + padDuration);
	osc2.connect(gain2);

	// Layer 3: Detuned -5 cents
	const osc3 = audioCtx.createOscillator();
	const gain3 = audioCtx.createGain();
	osc3.type = 'sine';
	osc3.frequency.value = freq * 0.997;
	gain3.gain.setValueAtTime(0, startTime);
	gain3.gain.linearRampToValueAtTime(0.12, startTime + 0.15);
	gain3.gain.setValueAtTime(0.12, startTime + padDuration - 0.3);
	gain3.gain.linearRampToValueAtTime(0, startTime + padDuration);
	osc3.connect(gain3);

	// Layer 4: Octave up, very quiet — shimmer
	const osc4 = audioCtx.createOscillator();
	const gain4 = audioCtx.createGain();
	osc4.type = 'triangle';
	osc4.frequency.value = freq * 2;
	gain4.gain.setValueAtTime(0, startTime);
	gain4.gain.linearRampToValueAtTime(0.04, startTime + 0.2);
	gain4.gain.setValueAtTime(0.04, startTime + padDuration - 0.4);
	gain4.gain.linearRampToValueAtTime(0, startTime + padDuration);
	osc4.connect(gain4);

	// Layer 5: Sub — one octave down
	const sub = audioCtx.createOscillator();
	const subGain = audioCtx.createGain();
	sub.type = 'sine';
	sub.frequency.value = freq / 2;
	subGain.gain.setValueAtTime(0, startTime);
	subGain.gain.linearRampToValueAtTime(0.06, startTime + 0.1);
	subGain.gain.setValueAtTime(0.06, startTime + padDuration - 0.3);
	subGain.gain.linearRampToValueAtTime(0, startTime + padDuration);
	sub.connect(subGain);

	// Low-pass filter on everything for warmth
	const filter = audioCtx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = freq * 3;
	filter.Q.value = 0.5;

	// Connect all through filter → destination
	gain1.connect(filter);
	gain2.connect(filter);
	gain3.connect(filter);
	gain4.connect(filter);
	subGain.connect(filter);
	filter.connect(dest);

	// Start/stop all
	[osc1, osc2, osc3, osc4, sub].forEach((osc) => {
		osc.start(startTime);
		osc.stop(startTime + padDuration);
	});
}
