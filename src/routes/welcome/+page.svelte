<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import QuizSession from '../../components/QuizSession.svelte';
	import { createFREConfig } from '$lib/quiz/configs/fre';
	import { loadStateV4, saveStateV4 } from '$lib/state/storage';

	// Redirect if FRE already completed
	onMount(() => {
		const state = loadStateV4();
		if (state.settings.hasCompletedFRE) {
			goto(`${base}/`);
		}
	});

	const config = createFREConfig();

	const freConfig = {
		...config,
		onSessionEnd(state: import('$lib/state/schema').UserStateV4) {
			state.settings.hasCompletedFRE = true;
			saveStateV4(state);
			goto(`${base}/`);
		},
	};
</script>

<QuizSession config={freConfig} />
