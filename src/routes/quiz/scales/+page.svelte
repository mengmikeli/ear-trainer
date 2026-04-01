<script lang="ts">
	import QuizSession from '../../../components/QuizSession.svelte';
	import { createScaleConfig } from '$lib/quiz/configs/scales';
	import { loadStateV4 } from '$lib/state/storage';

	const state = loadStateV4();
	const config = createScaleConfig(state);
</script>

<QuizSession {config} initialState={state} />
