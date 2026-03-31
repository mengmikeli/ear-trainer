<script lang="ts">
	import QuizSession from '../../../components/QuizSession.svelte';
	import { createModeConfig } from '$lib/quiz/configs/modes';
	import { loadStateV4 } from '$lib/state/storage';

	const state = loadStateV4();
	const config = createModeConfig(state);
</script>

<QuizSession {config} initialState={state} />
