/**
 * Svelte 5 reactive wrapper around QuizController.
 *
 * Wraps the plain-class controller with `$state()` so that all property
 * mutations are tracked by Svelte's fine-grained reactivity system.
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
 * Returns a `$state`-wrapped QuizController instance whose properties
 * are deeply reactive in Svelte 5 components.
 */
export function createQuizController(
	config: QuizSessionConfig,
	initialState?: UserStateV4,
) {
	const ctrl = $state(new QuizController(config, initialState));
	return ctrl;
}
