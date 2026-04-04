<script lang="ts">
	import { page } from '$app/state';
	import QuizSession from '../../../../components/QuizSession.svelte';
	import { createAdaptiveConfig } from '$lib/quiz/configs/adaptive';
	import { loadStateV4 } from '$lib/state/storage';
	import type { ContentPack } from '$lib/state/schema';

	const pack = page.params.pack as ContentPack;
	const state = loadStateV4();
	const config = createAdaptiveConfig(state, pack);
</script>

<QuizSession {config} initialState={state} />
