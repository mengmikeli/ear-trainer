<script lang="ts">
	import QuizSession from '../../../components/QuizSession.svelte';
	import { createIntervalConfig } from '$lib/quiz/configs/intervals';
	import { loadStateV4 } from '$lib/state/storage';

	const state = loadStateV4();
	const config = createIntervalConfig(state);
</script>

<QuizSession {config} initialState={state} />
