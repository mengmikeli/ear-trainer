/**
 * Svelte 5 reactive wrapper around QuizController.
 *
 * Uses a custom Proxy + $state tick counter so that property mutations
 * inside class methods (including async ones via RAF/setTimeout) trigger
 * Svelte's fine-grained reactivity system.
 *
 * Why not just `$state(new QuizController(...))`?
 * Svelte 5's $state() proxy binds method `this` to the raw target object,
 * so mutations inside methods bypass the reactive proxy entirely.
 * This wrapper solves that by creating a Proxy where:
 *   - Every `get` reads a $state tick (creating a Svelte dependency)
 *   - Every `set` increments the tick (triggering re-renders)
 *   - `this` inside methods is the proxy itself (so nested mutations
 *     also go through the set trap, including RAF/setTimeout callbacks)
 *
 * Usage in a component:
 *   const ctrl = createQuizController(config);
 *   // ctrl.phase, ctrl.question, etc. are all reactive
 */

import { QuizController } from './controller';
import type { QuizSessionConfig } from './types';
import type { UserStateV4 } from '$lib/state/schema';

/**
 * Create a reactive quiz controller.
 *
 * Returns a Proxy-wrapped QuizController where all property reads
 * track a reactive tick and all writes increment it, ensuring Svelte
 * re-renders on any state change — even those deferred via RAF/setTimeout.
 */
export function createQuizController(
	config: QuizSessionConfig,
	initialState?: UserStateV4,
) {
	let _tick = $state(0);
	const raw = new QuizController(config, initialState);

	const handler: ProxyHandler<QuizController> = {
		get(target, prop, receiver) {
			// Touch _tick to create a Svelte dependency for every property read
			void _tick;
			// Use receiver (the proxy) so that getters also have `this` = proxy
			return Reflect.get(target, prop, receiver);
		},
		set(target, prop, value) {
			const result = Reflect.set(target, prop, value, target);
			// Increment tick to signal Svelte that something changed
			_tick++;
			return result;
		},
	};

	return new Proxy(raw, handler);
}
