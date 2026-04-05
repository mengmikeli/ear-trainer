<script lang="ts">
	import { page } from '$app/state';
	import QuizSession from '../../../../components/QuizSession.svelte';
	import { createAdaptiveConfig } from '$lib/quiz/configs/adaptive';
	import { loadStateV4 } from '$lib/state/storage';
	import type { ContentPack } from '$lib/state/schema';

	const packColors: Record<string, string> = {
		beginner: '#00FF41',
		blues: '#FF3399',
		jazz: '#9B8EC4',
		advanced: '#FF8800',
	};

	const pack = page.params.pack as ContentPack;
	const state = loadStateV4();
	const config = createAdaptiveConfig(state, pack);
	config.accentColor = packColors[pack];
</script>

<QuizSession {config} initialState={state} />
