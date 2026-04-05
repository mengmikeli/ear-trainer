import type { EntryGenerator } from './$types';

export const entries: EntryGenerator = () => {
	return [
		{ pack: 'beginner' },
		{ pack: 'blues' },
		{ pack: 'jazz' },
		{ pack: 'advanced' },
	];
};
