import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['tests/**/*.test.ts'],
		alias: {
			// @capacitor/app accesses `document` at import time — mock it in Node
			'@capacitor/app': new URL('./tests/__mocks__/@capacitor/app.ts', import.meta.url).pathname
		}
	}
});
