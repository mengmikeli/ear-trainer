/**
 * Shared Chladni visualization configuration.
 * Used by /lab and any future quiz integration.
 */

/** Detect mobile for particle count scaling */
function isMobile(): boolean {
	if (typeof window === 'undefined') return false;
	return window.innerWidth < 600;
}

export const CHLADNI_CONFIG = {
	/** Number of particles (scaled for mobile) */
	get particleCount() { return isMobile() ? 1500 : 3500; },

	/** Base particle settle speed (drift toward nodal lines) */
	settleSpeedBase: 0.003,

	/** Boosted settle speed during migration (interval switch / replay) */
	settleSpeedBoost: 0.025,

	/** Base particle shake amplitude */
	shakeBase: 0.02,

	/** Additional shake driven by audio amplitude */
	shakeAudio: 0.05,

	/** Migration burst duration in frames (90 frames ≈ 1.5s at 60fps) */
	migrateDuration: 90,

	/** Particle color (at rest) */
	particleColor: '#3344ff',

	/** Particle color during migration (brighter) */
	particleMigrateColor: '#5A7AFF',

	/** Particle base alpha */
	particleAlpha: 0.6,

	/** Particle size in pixels */
	particleSize: 1,
} as const;

export const LISSAJOUS_CONFIG = {
	/** Number of points in the Lissajous loop */
	loopPoints: 400,

	/** Phase offset between X and Y axes */
	phaseDelta: Math.PI / 2,

	/** Speed of the leading dot (phase advance per frame) */
	speed: 0.02,

	/** Line color */
	lineColor: '#C2FE0C',

	/** Line width */
	lineWidth: 1.5,

	/** Glow/bloom blur radius */
	shadowBlur: 4,

	/** Trail fade rate (higher = faster fade) */
	fadeRate: 0.08,

	/** Radius multiplier relative to min(cx, cy) */
	radiusScale: 0.82,
} as const;
