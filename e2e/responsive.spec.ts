import { test, expect } from '@playwright/test';

async function skipFRE(page: import('@playwright/test').Page) {
	await page.goto('/');
	await page.evaluate(() => {
		const raw = localStorage.getItem('ear-trainer-state');
		const state = raw ? JSON.parse(raw) : {};
		if (!state.settings) state.settings = {};
		state.settings.hasCompletedFRE = true;
		localStorage.setItem('ear-trainer-state', JSON.stringify(state));
	});
}

test('desktop shows sidebar navigation', async ({ page }) => {
	await page.setViewportSize({ width: 1200, height: 800 });
	await skipFRE(page);
	await page.goto('/');

	// Sidebar should be visible (rendered by +layout.svelte at ≥768px)
	await expect(page.locator('.side-nav')).toBeVisible({ timeout: 10000 });
	// Bottom nav should be hidden on desktop
	await expect(page.locator('.bottom-nav')).toBeHidden();
});

test('mobile shows bottom navigation', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await skipFRE(page);
	await page.goto('/');

	// Bottom nav visible on mobile
	await expect(page.locator('.bottom-nav')).toBeVisible({ timeout: 10000 });
});
