<script lang="ts">
	import QuizSession from '../../../components/QuizSession.svelte';
	import { createAdaptiveConfig } from '$lib/quiz/configs/adaptive';
	import { loadStateV4 } from '$lib/state/storage';

	const state = loadStateV4();
	const config = createAdaptiveConfig(state);
</script>

<QuizSession {config} initialState={state} />
