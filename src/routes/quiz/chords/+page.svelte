<script lang="ts">
	import QuizSession from '../../../components/QuizSession.svelte';
	import { createChordConfig } from '$lib/quiz/configs/chords';
	import { loadStateV4 } from '$lib/state/storage';

	const state = loadStateV4();
	const config = createChordConfig(state);
</script>

<QuizSession {config} initialState={state} />
