import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { execSync } from 'child_process';

// Inject git short hash at build time
const buildHash = (() => {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'dev';
	}
})();

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		'__BUILD_HASH__': JSON.stringify(buildHash)
	},
	test: {
		include: ['tests/**/*.test.ts'],
		alias: {
			// @capacitor/app accesses `document` at import time — mock it in Node
			'@capacitor/app': new URL('./tests/__mocks__/@capacitor/app.ts', import.meta.url).pathname
		}
	}
});
