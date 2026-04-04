import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	timeout: 30000,
	retries: 0,
	use: {
		baseURL: 'http://localhost:4173',
		headless: true,
		viewport: { width: 375, height: 812 }, // iPhone-like default
	},
	webServer: {
		command: 'npm run build && npx vite preview --port 4173',
		port: 4173,
		timeout: 60000,
		reuseExistingServer: true,
	},
});
